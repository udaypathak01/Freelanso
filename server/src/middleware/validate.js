import { ValidationError } from "../utils/AppError.js";

export function validate(schemas = {}) {
  return function validateRequest(req, res, next) {
    const parsed = {};
    const sources = {
      body: req.body ?? {},
      query: Object.assign({}, req.query),
      params: Object.assign({}, req.params),
    };

    for (const source of ["body", "query", "params"]) {
      const schema = schemas[source];
      if (!schema) continue;
      const result = schema.safeParse(sources[source]);
      if (!result.success) {
        const details = result.error.issues.map((issue) => ({
          path: [source, ...issue.path],
          code: issue.code,
          message: issue.message,
        }));
        return next(new ValidationError(details));
      }
      parsed[source] = result.data;
    }

    req.validated = parsed;
    return next();
  };
}
