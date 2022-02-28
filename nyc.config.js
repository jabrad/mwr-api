module.exports = {
    all    : true,
    include: [
        'dist/lib/**/*.js',
    ],
    exclude: [
        'dist/lib/**/*.test.js',
    ],
    excludeAfterRemap: false,
    cache            : process.env.NODE_ENV !== 'production',
};
