import { z } from 'zod';

/**
 * Converts a basic JSON Schema to a Zod schema object.
 * 
 * Supports standard types: string, integer, number, boolean, array, object.
 * Handles: description, required fields.
 * 
 * @param {object} schema - The JSON Schema object to convert.
 * @returns {z.ZodObject|z.ZodTypeAny} A Zod schema.
 */
export function jsonSchemaToZod(schema) {
  if (!schema || schema.type !== 'object') {
    return z.object({}).passthrough();
  }

  const shape = {};
  const properties = schema.properties || {};
  const required = schema.required || [];

  for (const [key, prop] of Object.entries(properties)) {
    let zType;
    switch (prop.type) {
      case 'string':
        zType = z.string();
        break;
      case 'integer':
      case 'number':
        zType = z.number();
        break;
      case 'boolean':
        zType = z.boolean();
        break;
      case 'array':
        zType = z.array(z.any());
        break;
      case 'object':
        // For nested objects, we default to any for now to avoid deep recursion complexity
        // unless we want to recursively call jsonSchemaToZod.
        zType = z.any();
        break;
      default:
        zType = z.any();
    }

    if (prop.description) {
      zType = zType.describe(prop.description);
    }

    if (!required.includes(key)) {
      zType = zType.optional();
    }

    shape[key] = zType;
  }

  return z.object(shape).passthrough();
}
