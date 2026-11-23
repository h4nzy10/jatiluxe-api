const requiredString = (fieldName, maxLen) => {
  let schema = z.string().trim().min(1, `${fieldName} required`);
  if (maxLen) schema = schema.max(maxLen, `${fieldName} max ${maxLen} characters`);
  return schema;
}