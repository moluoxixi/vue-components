import { z } from 'zod'

const FORBIDDEN_IDENTIFIERS = new Set(['__proto__', 'constructor', 'prototype'])

export const identifierSchema = z.string()
  .min(1)
  .max(128)
  .refine(value => value === value.trim(), 'Identifier must not contain surrounding whitespace')
  .refine(value => !FORBIDDEN_IDENTIFIERS.has(value), 'Identifier is not allowed')

export const registryKeySchema = z.string()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/)

export const registryVersionSchema = z.string()
  .min(1)
  .max(80)
  .refine(value => value === value.trim(), 'Registry version must not contain surrounding whitespace')

export const registryFingerprintSchema = z.string().regex(/^fnv1a:[0-9a-f]{8}$/)
