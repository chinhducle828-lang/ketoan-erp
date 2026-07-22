import { IdempotencyProvider } from '../context/IdempotencyContext';

/**
 * Idempotency Provider Component
 * Wrapper component để cung cấp IdempotencyContext cho toàn bộ app
 * Sử dụng tại root level của ứng dụng
 */
export default function IdempotencyProviderWrapper({ children }) {
  return <IdempotencyProvider>{children}</IdempotencyProvider>;
}

/**
 * HOC để wrap bất kỳ component nào với IdempotencyProvider
 */
export function withIdempotencyProvider(WrappedComponent) {
  return function WithIdempotencyProviderWrapper(props) {
    return (
      <IdempotencyProviderWrapper>
        <WrappedComponent {...props} />
      </IdempotencyProviderWrapper>
    );
  };
}