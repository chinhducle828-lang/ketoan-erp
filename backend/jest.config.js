export default {
  verbose: true,
  // Bật tính năng gom kết quả từ nhiều project chạy song song
  projects: [
    // -----------------------------------------------------------------
    // PROJECT 1: Cấu hình cho toàn bộ các file Test Backend (.test.js)
    // -----------------------------------------------------------------
    {
      displayName: 'backend',
      testEnvironment: 'node', // Môi trường Node.js thuần
      transform: {},
      moduleFileExtensions: ['js', 'mjs'],
      testMatch: ['**/tests/**/*.test.js'], // Chỉ quét các file .test.js
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      injectGlobals: true,
      fakeTimers: { enableGlobally: true },
      transformIgnorePatterns: [
        'node_modules/(?!(zod|ioredis|jsonwebtoken|bcryptjs|pg)/)',
      ],
    },
    // -----------------------------------------------------------------
    // PROJECT 2: Cấu hình riêng cho file Test Giao diện React (.test.jsx)
    // -----------------------------------------------------------------
    {
      displayName: 'frontend-ui',
      testEnvironment: 'jsdom', // Giả lập môi trường trình duyệt bắt buộc cho React
      moduleFileExtensions: ['js', 'jsx', 'mjs'],
      testMatch: ['**/tests/**/*.test.jsx'], // Chỉ quét file test UI .test.jsx
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
      injectGlobals: true,
      transform: {
        // Sử dụng babel-jest để biên dịch cú pháp JSX/React sang JS thường
        '^.+\\.(js|jsx|mjs)$': 'babel-jest',
      },
      // Giả lập ánh xạ các file CSS/Asset từ front-end để tránh crash render
      moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      },
    }
  ],
  // Giữ nguyên phần cấu hình đo lường độ phủ mã nguồn (Coverage) chung
  collectCoverageFrom: [
    'validators/**/*.js',
    'services/**/*.js',
    'middleware/**/*.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};