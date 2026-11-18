/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import {
  getSettingsSchema,
  SETTINGS_SCHEMA_DEFINITIONS,
} from './settings-schema.js';
import type {
  SettingCollectionDefinition,
  SettingDefinition,
} from './settings-types.js';

// Helper to build Zod schema from the JSON-schema-like definitions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildZodSchemaFromJsonSchema(def: any): z.ZodType {
  if (def.anyOf) {
    return z.union(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      def.anyOf.map((d: any) => buildZodSchemaFromJsonSchema(d)),
    );
  }

  if (def.type === 'string') {
    if (def.enum) return z.enum(def.enum as [string, ...string[]]);
    return z.string();
  }
  if (def.type === 'number') return z.number();
  if (def.type === 'boolean') return z.boolean();

  if (def.type === 'array') {
    if (def.items) {
      return z.array(buildZodSchemaFromJsonSchema(def.items));
    }
    return z.array(z.unknown());
  }

  if (def.type === 'object') {
    const shape: Record<string, z.ZodType> = {};
    if (def.properties) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const [key, propDef] of Object.entries(def.properties) as any) {
        let propSchema = buildZodSchemaFromJsonSchema(propDef);
        if (
          def.required &&
          Array.isArray(def.required) &&
          def.required.includes(key)
        ) {
          // keep it required
        } else {
          propSchema = propSchema.optional();
        }
        shape[key] = propSchema;
      }
    }

    if (def.additionalProperties === false) {
      return z.strictObject(shape);
    } else if (typeof def.additionalProperties === 'object') {
      return z
        .object(shape)
        .catchall(buildZodSchemaFromJsonSchema(def.additionalProperties));
    }

    return z.looseObject(shape);
  }

  return z.unknown();
}

/**
 * Builds a Zod enum schema from options array
 */
function buildEnumSchema(
  options: ReadonlyArray<{ value: string | number | boolean; label: string }>,
): z.ZodType {
  if (!options || options.length === 0) {
    throw new Error(
      `Enum type must have options defined. Check your settings schema definition.`,
    );
  }
  return z.literal(options.map((opt) => opt.value));
}

/**
 * Builds a Zod object shape from properties record
 */
function buildObjectShapeFromProperties(
  properties: Record<string, SettingDefinition>,
): Record<string, z.ZodType> {
  const shape: Record<string, z.ZodType> = {};
  for (const [key, childDef] of Object.entries(properties)) {
    shape[key] = buildZodSchemaFromDefinition(childDef);
  }
  return shape;
}

/**
 * Builds a Zod schema for primitive types (string, number, boolean)
 */
function buildPrimitiveSchema(
  type: 'string' | 'number' | 'boolean',
): z.ZodType {
  switch (type) {
    case 'string':
      return z.string();
    case 'number':
      return z.number();
    case 'boolean':
      return z.boolean();
    default:
      return z.unknown();
  }
}

const REF_SCHEMAS: Record<string, z.ZodType> = {};

// Initialize REF_SCHEMAS
for (const [name, def] of Object.entries(SETTINGS_SCHEMA_DEFINITIONS)) {
  REF_SCHEMAS[name] = buildZodSchemaFromJsonSchema(def);
}

/**
 * Recursively builds a Zod schema from a SettingDefinition
 */
function buildZodSchemaFromDefinition(
  definition: SettingDefinition,
): z.ZodType {
  let baseSchema: z.ZodType;

  // Handle refs using registry
  if (definition.ref && definition.ref in REF_SCHEMAS) {
    return REF_SCHEMAS[definition.ref].optional();
  }

  switch (definition.type) {
    case 'string':
    case 'number':
    case 'boolean':
      baseSchema = buildPrimitiveSchema(definition.type);
      break;

    case 'enum': {
      baseSchema = buildEnumSchema(definition.options!);
      break;
    }

    case 'array':
      if (definition.items) {
        const itemSchema = buildZodSchemaFromCollection(definition.items);
        baseSchema = z.array(itemSchema);
      } else {
        baseSchema = z.array(z.unknown());
      }
      break;

    case 'object':
      if (definition.properties) {
        const shape = buildObjectShapeFromProperties(definition.properties);
        baseSchema = z.looseObject(shape);

        if (definition.additionalProperties) {
          const additionalSchema = buildZodSchemaFromCollection(
            definition.additionalProperties,
          );
          baseSchema = z.object(shape).catchall(additionalSchema);
        }
      } else if (definition.additionalProperties) {
        const valueSchema = buildZodSchemaFromCollection(
          definition.additionalProperties,
        );
        baseSchema = z.record(z.string(), valueSchema);
      } else {
        baseSchema = z.record(z.string(), z.unknown());
      }
      break;

    default:
      baseSchema = z.unknown();
  }

  // Make all fields optional since settings are partial
  return baseSchema.optional();
}

/**
 * Builds a Zod schema from a SettingCollectionDefinition
 */
function buildZodSchemaFromCollection(
  collection: SettingCollectionDefinition,
): z.ZodType {
  if (collection.ref && collection.ref in REF_SCHEMAS) {
    return REF_SCHEMAS[collection.ref];
  }

  switch (collection.type) {
    case 'string':
    case 'number':
    case 'boolean':
      return buildPrimitiveSchema(collection.type);

    case 'enum': {
      return buildEnumSchema(collection.options!);
    }

    case 'array':
      if (collection.properties) {
        const shape = buildObjectShapeFromProperties(collection.properties);
        return z.array(z.object(shape));
      }
      return z.array(z.unknown());

    case 'object':
      if (collection.properties) {
        const shape = buildObjectShapeFromProperties(collection.properties);
        return z.looseObject(shape);
      }
      return z.record(z.string(), z.unknown());

    default:
      return z.unknown();
  }
}

/**
 * Builds the complete Zod schema for Settings from SETTINGS_SCHEMA
 */
function buildSettingsZodSchema() {
  const schema = getSettingsSchema();
  const shape: Record<string, z.ZodType> = {};

  for (const [key, definition] of Object.entries(schema)) {
    shape[key] = buildZodSchemaFromDefinition(definition);
  }

  return z.looseObject(shape);
}

export const settingsZodSchema = buildSettingsZodSchema();

/**
 * Validates settings data against the Zod schema
 */
export function validateSettings(data: unknown): {
  success: boolean;
  data?: unknown;
  error?: z.ZodError;
} {
  const result = settingsZodSchema.safeParse(data);
  return result;
}

/**
 * Format a Zod error into a helpful error message
 */
export function formatValidationError(
  error: z.ZodError,
  filePath: string,
): string {
  const lines: string[] = [];
  lines.push(`Invalid configuration in ${filePath}:`);
  lines.push('');

  const MAX_ERRORS_TO_DISPLAY = 5;
  const displayedIssues = error.issues.slice(0, MAX_ERRORS_TO_DISPLAY);

  for (const issue of displayedIssues) {
    const path = issue.path.reduce<string>(
      (acc, curr) =>
        typeof curr === 'number'
          ? `${acc}[${curr}]`
          : `${acc ? acc + '.' : ''}${String(curr)}`,
      '',
    );
    lines.push(`Error in: ${path || '(root)'}`);
    lines.push(`    ${issue.message}`);
    lines.push('');
  }

  if (error.issues.length > MAX_ERRORS_TO_DISPLAY) {
    lines.push(
      `...and ${error.issues.length - MAX_ERRORS_TO_DISPLAY} more errors.`,
    );
    lines.push('');
  }

  lines.push('Please fix the configuration.');
  lines.push(
    'See: https://github.com/cofy-x/dsh-console/blob/main/docs/get-started/configuration.md',
  );

  return lines.join('\n');
}
