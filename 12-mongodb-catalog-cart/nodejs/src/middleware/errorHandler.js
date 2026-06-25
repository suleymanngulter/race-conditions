// Merkezi hata yakalama — Mongoose validation / cast hatalarını HTTP yanıtına çevirir.
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = err.statusCode || 500;
  let message = err.message || "Sunucu hatası";

  if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  if (err.name === "CastError") {
    status = 400;
    message = `Geçersiz ${err.path}: ${err.value}`;
  }

  if (err.code === 11000) {
    status = 409;
    message = "Kayıt zaten mevcut";
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

module.exports = errorHandler;
