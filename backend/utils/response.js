function ok(res, data, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, data, message });
}

function fail(res, message = 'Terjadi kesalahan', status = 400) {
  return res.status(status).json({ success: false, data: null, message });
}

class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

module.exports = { ok, fail, ApiError };
