export function ok(res, data, meta = {}) {
  return res.status(200).json({ success: true, data, meta });
}

export function created(res, data, meta = {}) {
  return res.status(201).json({ success: true, data, meta });
}

export function noContent(res) {
  return res.status(204).end();
}

export function paginated(res, data, nextCursor = null, meta = {}) {
  return ok(res, data, { ...meta, nextCursor });
}
