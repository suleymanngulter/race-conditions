// async route handler'ları try/catch sarmalayıcı — merkezi errorHandler'a düşürür.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
