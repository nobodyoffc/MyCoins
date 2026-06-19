module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!(@noble|bs58|bs58check|base-x|@react-native|react-native)/)',
  ],
};
