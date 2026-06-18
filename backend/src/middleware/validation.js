const { z } = require("zod");

const buildValidationError = (error) => {
  const details = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));

  return {
    error: "Invalid input",
    code: "INVALID_INPUT",
    details,
  };
};

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body || {});
  if (!result.success) {
    return res.status(400).json(buildValidationError(result.error));
  }
  req.body = result.data;
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query || {});
  if (!result.success) {
    return res.status(400).json(buildValidationError(result.error));
  }
  req.query = result.data;
  next();
};

const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params || {});
  if (!result.success) {
    return res.status(400).json(buildValidationError(result.error));
  }
  req.params = result.data;
  next();
};

module.exports = { validateBody, validateQuery, validateParams, z };
