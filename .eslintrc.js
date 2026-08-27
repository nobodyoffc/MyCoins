module.exports = {
  root: true,
  extends: '@react-native',
  // src/crypto/vendor holds verbatim/near-verbatim copies of @noble/hashes
  // modules; linting them only produces noise against upstream's style.
  ignorePatterns: ['src/crypto/vendor/'],
};
