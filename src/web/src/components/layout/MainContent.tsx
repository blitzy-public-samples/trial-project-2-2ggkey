import React, { useCallback, ErrorInfo } from 'react';
import styled from 'styled-components';
import LoadingSpinner from '../common/LoadingSpinner';

// Version comments for external dependencies
// react: ^18.2.0
// styled-components: ^5.3.0

/**
 * Props interface for the MainContent component
 */
interface MainContentProps {
  children: React.ReactNode;
  isLoading?: boolean;
  className?: string;
  testId?: string;
}

/**
 * Styled container for the main content area implementing the central panel
 * of the three-panel layout with responsive design and theme support
 */
const MainContentContainer = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
  background-color: var(--theme-background);
  color: var(--theme-text);
  transition: var(--theme-transition);
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;

  /* Implement responsive padding based on breakpoints */
  padding: var(--spacing-md);

  @media (min-width: ${props => props.theme.breakpoints?.tablet || '768px'}) {
    padding: var(--spacing-lg);
  }

  @media (min-width: ${props => props.theme.breakpoints?.desktop || '1024px'}) {
    padding: var(--spacing-xl);
  }

  /* Scrollbar styling with theme support */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--theme-background);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--theme-divider);
    border-radius: var(--border-radius-full);
  }

  /* High contrast mode support */
  @media screen and (-ms-high-contrast: active) {
    border: 1px solid currentColor;
  }
`;

/**
 * Styled container for the loading spinner with centered positioning
 */
const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  width: 100%;
  background-color: var(--theme-background);
  transition: var(--theme-transition);
`;

/**
 * Error boundary class for handling runtime errors in the main content area
 */
class MainContentErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MainContent Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <MainContentContainer>
          <div role="alert" className="error-boundary">
            <h2>Something went wrong.</h2>
            <p>Please try refreshing the page or contact support if the problem persists.</p>
          </div>
        </MainContentContainer>
      );
    }

    return this.props.children;
  }
}

/**
 * MainContent component that implements the central panel of the three-panel layout
 * with loading state support, error boundary, and theme-aware styling
 *
 * @param {MainContentProps} props - Component props
 * @returns {JSX.Element} Rendered main content component
 */
const MainContent: React.FC<MainContentProps> = React.memo(({
  children,
  isLoading = false,
  className = '',
  testId = 'main-content'
}) => {
  // Memoized loading spinner render function
  const renderLoadingSpinner = useCallback(() => (
    <LoadingContainer>
      <LoadingSpinner
        size="large"
        color="var(--theme-primary)"
        ariaLabel="Loading content..."
      />
    </LoadingContainer>
  ), []);

  return (
    <MainContentErrorBoundary>
      <MainContentContainer
        role="main"
        className={`main-content ${className}`}
        data-testid={testId}
        aria-busy={isLoading}
      >
        {isLoading ? renderLoadingSpinner() : children}
      </MainContentContainer>
    </MainContentErrorBoundary>
  );
});

// Display name for debugging purposes
MainContent.displayName = 'MainContent';

// Export the component and its props interface
export default MainContent;
export type { MainContentProps };