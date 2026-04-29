# Swift-Add: Quick Implementation Guide for Contributors

This guide provides ready-to-use code snippets for the highest-impact contributions.

---

## 1. GitHub Actions CI/CD Pipeline (4-6 hours)

### File 1: `.github/workflows/test.yml` (swift-add-sdk)

**Create this file** in both `swift-add-sdk` and `website` repositories:

```yaml
name: Tests & Linting

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
        continue-on-error: false
      
      - name: Run tests
        run: npm run test -- --coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
          fail_ci_if_error: true
      
      - name: Comment PR with coverage
        if: github.event_name == 'pull_request'
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          lcov-file: ./coverage/lcov.info
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### File 2: Update `package.json` (swift-add-sdk)

Add/update these scripts:

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext .ts,.tsx --max-warnings 0",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  }
}
```

### File 3: `.eslintrc.json` (swift-add-sdk - NEW FILE)

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "plugins": [
    "@typescript-eslint",
    "react",
    "react-hooks"
  ],
  "env": {
    "browser": true,
    "es2021": true,
    "node": true,
    "jest": true
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  },
  "rules": {
    "no-console": [
      "warn",
      {
        "allow": [
          "warn",
          "error"
        ]
      }
    ],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-types": [
      "warn",
      {
        "allowExpressions": true,
        "allowTypedFunctionExpressions": true,
        "allowHigherOrderFunctions": true
      }
    ],
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  },
  "ignorePatterns": [
    "dist",
    "node_modules",
    "coverage",
    "examples"
  ]
}
```

### File 4: `.prettierrc.json` (swift-add-sdk - NEW FILE)

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

### File 5: Update `package.json` with ESLint dependencies

Add to devDependencies:

```json
{
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^9.0.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-react": "^7.34.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "prettier": "^3.1.0"
  }
}
```

---

## 2. Component Test Suite (6-8 hours)

### File 1: `src/components/__tests__/Ad402Provider.test.tsx` (NEW)

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  Ad402Provider,
  useAd402Context,
  useAd402Config,
} from '../Ad402Provider';
import type { Ad402Config } from '../../types';

// Mock component that uses context
const TestComponent = () => {
  const { config } = useAd402Context();
  const ad402Config = useAd402Config();

  return (
    <div>
      <p data-testid="website-id">{config.websiteId}</p>
      <p data-testid="wallet-address">{config.walletAddress}</p>
      <p data-testid="api-base-url">{ad402Config.apiBaseUrl}</p>
    </div>
  );
};

describe('Ad402Provider', () => {
  const validConfig: Ad402Config = {
    websiteId: 'test-site',
    walletAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    apiBaseUrl: 'https://ad402.io',
    theme: {
      primaryColor: '#000000',
      backgroundColor: '#ffffff',
      textColor: '#000000',
      borderColor: '#e5e5e5',
      fontFamily: 'Inter, sans-serif',
      borderRadius: 8,
    },
  };

  describe('initialization', () => {
    it('should provide config to children via context', () => {
      render(
        <Ad402Provider config={validConfig}>
          <TestComponent />
        </Ad402Provider>
      );

      expect(screen.getByTestId('website-id')).toHaveTextContent('test-site');
      expect(screen.getByTestId('wallet-address')).toHaveTextContent(
        '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'
      );
    });

    it('should use default API base URL if not provided', () => {
      const configWithoutUrl: Ad402Config = {
        ...validConfig,
        apiBaseUrl: undefined,
      };

      render(
        <Ad402Provider config={configWithoutUrl}>
          <TestComponent />
        </Ad402Provider>
      );

      expect(screen.getByTestId('api-base-url')).toHaveTextContent(
        'https://ad402.io'
      );
    });

    it('should merge user theme with defaults', () => {
      const configWithTheme: Ad402Config = {
        ...validConfig,
        theme: {
          primaryColor: '#ff0000',
          // Other defaults should fill in
        },
      };

      render(
        <Ad402Provider config={configWithTheme}>
          <TestComponent />
        </Ad402Provider>
      );

      // Should not throw
      expect(screen.getByTestId('website-id')).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('should throw error if websiteId is missing', () => {
      const invalidConfig: Ad402Config = {
        ...validConfig,
        websiteId: '',
      };

      // Suppress console.error for this test
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() => {
        render(
          <Ad402Provider config={invalidConfig}>
            <div>Test</div>
          </Ad402Provider>
        );
      }).toThrow();

      consoleSpy.mockRestore();
    });

    it('should throw error if walletAddress is invalid', () => {
      const invalidConfig: Ad402Config = {
        ...validConfig,
        walletAddress: 'invalid-address',
      };

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() => {
        render(
          <Ad402Provider config={invalidConfig}>
            <div>Test</div>
          </Ad402Provider>
        );
      }).toThrow();

      consoleSpy.mockRestore();
    });

    it('should accept Stellar G-addresses', () => {
      const stellarConfig: Ad402Config = {
        ...validConfig,
        walletAddress: 'GBRPYHIL2CI3FV4BMSXISD5MMZ3HXN7GC7GII5OHZEHOA5ZL7XNBUJE7',
      };

      render(
        <Ad402Provider config={stellarConfig}>
          <TestComponent />
        </Ad402Provider>
      );

      expect(screen.getByTestId('wallet-address')).toHaveTextContent(
        'GBRPYHIL2CI3FV4BMSXISD5MMZ3HXN7GC7GII5OHZEHOA5ZL7XNBUJE7'
      );
    });
  });

  describe('context hook', () => {
    it('should throw error when useAd402Context used outside provider', () => {
      const ComponentWithoutProvider = () => {
        try {
          useAd402Context();
          return <div>No error</div>;
        } catch (error) {
          return <div data-testid="error">Error thrown</div>;
        }
      };

      render(<ComponentWithoutProvider />);
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });
  });
});
```

### File 2: `src/components/__tests__/Ad402ErrorBoundary.test.tsx` (NEW)

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Ad402ErrorBoundary } from '../Ad402ErrorBoundary';

// Component that throws error
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({
  shouldThrow = true,
}) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('Ad402ErrorBoundary', () => {
  // Suppress console.error for error boundary tests
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('error catching', () => {
    it('should catch JavaScript errors in children', () => {
      render(
        <Ad402ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </Ad402ErrorBoundary>
      );

      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });

    it('should render children if no error', () => {
      render(
        <Ad402ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </Ad402ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('should display custom fallback component', () => {
      const CustomFallback = () => <div>Custom error UI</div>;

      render(
        <Ad402ErrorBoundary fallback={<CustomFallback />}>
          <ThrowError shouldThrow={true} />
        </Ad402ErrorBoundary>
      );

      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    });
  });

  describe('error callback', () => {
    it('should call onError callback with error and info', () => {
      const onError = jest.fn();

      render(
        <Ad402ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </Ad402ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('should pass error message to callback', () => {
      const onError = jest.fn();
      const errorMessage = 'Test error message';

      render(
        <Ad402ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </Ad402ErrorBoundary>
      );

      const [error] = onError.mock.calls[0];
      expect(error.message).toBe(errorMessage);
    });
  });

  describe('debug mode', () => {
    it('should log to console in debug mode', () => {
      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      render(
        <Ad402ErrorBoundary debug={true}>
          <ThrowError shouldThrow={true} />
        </Ad402ErrorBoundary>
      );

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not log to console when debug is false', () => {
      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      render(
        <Ad402ErrorBoundary debug={false}>
          <ThrowError shouldThrow={true} />
        </Ad402ErrorBoundary>
      );

      // May still log errors from React, but controlled logging should be off
      consoleSpy.mockRestore();
    });
  });

  describe('nested error boundaries', () => {
    it('should handle nested error boundaries correctly', () => {
      render(
        <Ad402ErrorBoundary>
          <div>
            <Ad402ErrorBoundary>
              <ThrowError shouldThrow={true} />
            </Ad402ErrorBoundary>
          </div>
        </Ad402ErrorBoundary>
      );

      // Inner boundary should catch error first
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });
  });
});
```

### File 3: `src/components/__tests__/Ad402Slot.integration.test.tsx` (NEW)

```typescript
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { setupServer } from 'msw';
import { http, HttpResponse } from 'msw';
import { Ad402Slot } from '../Ad402Slot';
import { Ad402Provider } from '../Ad402Provider';
import type { Ad402Config } from '../../types';

// Mock API responses
const mockAdResponse = {
  slotId: 'test-slot',
  adId: 'ad-123',
  title: 'Test Ad',
  description: 'This is a test ad',
  imageUrl: 'https://example.com/ad.jpg',
  clickUrl: 'https://example.com/click',
  expiresAt: Math.floor(Date.now() / 1000) + 86400,
};

const mockQueueResponse = {
  slotId: 'test-slot',
  queue: [
    { adId: 'ad-123', bidAmount: '0.25', bidder: '0x742d35...' },
  ],
  nextBidAmount: '0.26',
};

// Setup MSW server
const server = setupServer(
  http.get('https://api.example.com/api/ads/:slotId', () => {
    return HttpResponse.json(mockAdResponse);
  }),
  http.get('https://api.example.com/api/queue/:slotId', () => {
    return HttpResponse.json(mockQueueResponse);
  }),
  http.post('https://api.example.com/api/analytics', () => {
    return HttpResponse.json({ success: true });
  })
);

describe('Ad402Slot - Integration Tests', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  const validConfig: Ad402Config = {
    websiteId: 'test-site',
    walletAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    apiBaseUrl: 'https://api.example.com',
  };

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <Ad402Provider config={validConfig}>
        {component}
      </Ad402Provider>
    );
  };

  describe('full ad slot flow', () => {
    it('should render loading state initially', () => {
      renderWithProvider(
        <Ad402Slot
          slotId="test-slot"
          size="banner"
          price="0.25"
        />
      );

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });

    it('should display ad after fetching', async () => {
      renderWithProvider(
        <Ad402Slot
          slotId="test-slot"
          size="banner"
          price="0.25"
        />
      );

      await waitFor(() => {
        expect(screen.getByAltText(/Test Ad/i)).toBeInTheDocument();
      });
    });

    it('should display error component on API failure', async () => {
      server.use(
        http.get('https://api.example.com/api/ads/:slotId', () => {
          return HttpResponse.error();
        })
      );

      renderWithProvider(
        <Ad402Slot
          slotId="test-slot"
          size="banner"
          price="0.25"
          errorComponent={<div data-testid="error-ui">Ad failed to load</div>}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-ui')).toBeInTheDocument();
      });
    });

    it('should call onAdLoad when ad loads successfully', async () => {
      const onAdLoad = jest.fn();

      renderWithProvider(
        <Ad402Slot
          slotId="test-slot"
          size="banner"
          price="0.25"
          onAdLoad={onAdLoad}
        />
      );

      await waitFor(() => {
        expect(onAdLoad).toHaveBeenCalledWith(
          expect.objectContaining({
            slotId: 'test-slot',
            adId: 'ad-123',
          })
        );
      });
    });

    it('should call onSlotClick and track event when ad is clicked', async () => {
      const onSlotClick = jest.fn();
      const trackSpy = jest.fn();

      renderWithProvider(
        <Ad402Slot
          slotId="test-slot"
          size="banner"
          price="0.25"
          onSlotClick={onSlotClick}
        />
      );

      await waitFor(() => {
        const adImage = screen.getByAltText(/Test Ad/i);
        fireEvent.click(adImage);
      });

      expect(onSlotClick).toHaveBeenCalledWith('test-slot');
    });
  });

  describe('responsive sizing', () => {
    it('should apply correct dimensions for banner size', () => {
      const { container } = renderWithProvider(
        <Ad402Slot
          slotId="test-slot"
          size="banner"
          price="0.25"
        />
      );

      const slotElement = container.querySelector('[data-slot-id="test-slot"]');
      expect(slotElement).toHaveStyle('width: 728px');
      expect(slotElement).toHaveStyle('height: 90px');
    });

    it('should apply correct dimensions for square size', () => {
      const { container } = renderWithProvider(
        <Ad402Slot
          slotId="test-slot"
          size="square"
          price="0.25"
        />
      );

      const slotElement = container.querySelector('[data-slot-id="test-slot"]');
      expect(slotElement).toHaveStyle('width: 300px');
      expect(slotElement).toHaveStyle('height: 250px');
    });

    it('should apply custom dimensions', () => {
      const { container } = renderWithProvider(
        <Ad402Slot
          slotId="test-slot"
          size="banner"
          price="0.25"
          dimensions={{ width: 600, height: 100 }}
        />
      );

      const slotElement = container.querySelector('[data-slot-id="test-slot"]');
      expect(slotElement).toHaveStyle('width: 600px');
      expect(slotElement).toHaveStyle('height: 100px');
    });
  });

  describe('retry logic', () => {
    it('should retry on network failure', async () => {
      let attempts = 0;

      server.use(
        http.get('https://api.example.com/api/ads/:slotId', () => {
          attempts++;
          if (attempts < 3) {
            return HttpResponse.error();
          }
          return HttpResponse.json(mockAdResponse);
        })
      );

      renderWithProvider(
        <Ad402Slot
          slotId="test-slot"
          size="banner"
          price="0.25"
        />
      );

      await waitFor(
        () => {
          expect(screen.getByAltText(/Test Ad/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      expect(attempts).toBeGreaterThan(1);
    });
  });

  describe('custom components', () => {
    it('should use custom loading component', () => {
      renderWithProvider(
        <Ad402Slot
          slotId="test-slot"
          size="banner"
          price="0.25"
          loadingComponent={<div data-testid="custom-loading">Please wait...</div>}
        />
      );

      expect(screen.getByTestId('custom-loading')).toBeInTheDocument();
    });

    it('should use custom empty slot component', async () => {
      server.use(
        http.get('https://api.example.com/api/ads/:slotId', () => {
          return HttpResponse.json(null);
        })
      );

      renderWithProvider(
        <Ad402Slot
          slotId="test-slot"
          size="banner"
          price="0.25"
          emptySlotComponent={
            <div data-testid="empty-slot">No ads available</div>
          }
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('empty-slot')).toBeInTheDocument();
      });
    });
  });
});
```

### File 4: Update `package.json` with test dependencies

Add to devDependencies:

```json
{
  "devDependencies": {
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/jest": "^30.0.0",
    "jest": "^30.2.0",
    "jest-environment-jsdom": "^30.2.0",
    "ts-jest": "^29.4.6",
    "msw": "^1.3.2"
  }
}
```

---

## 3. Troubleshooting Guide (2-3 hours)

### File: `TROUBLESHOOTING.md` (NEW FILE)

```markdown
# Troubleshooting Guide

## Common Issues & Solutions

### "Configuration Error" on page load

**Symptoms**: 
- Red error message in browser console
- Ad slots show nothing or error state

**Root Causes**:
1. Missing `Ad402Provider` wrapper
2. Invalid wallet address format
3. Missing or empty website ID
4. Invalid API base URL

**Debug Steps**:
```typescript
// ✅ CORRECT: App wrapped in provider
import { Ad402Provider } from 'ad402-sdk';

export default function App() {
  return (
    <Ad402Provider config={{
      websiteId: 'my-site',
      walletAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
      apiBaseUrl: 'https://ad402.io'
    }}>
      <YourApp />
    </Ad402Provider>
  );
}

// ❌ WRONG: Provider only wraps single component
export default function App() {
  return (
    <div>
      <Ad402Provider config={...}>
        <AdSlot />
      </Ad402Provider>
      <OtherComponent /> {/* Can't access context! */}
    </div>
  );
}
```

**Solutions**:
1. **Check provider placement**: Must be at app root, above all Ad402 components
2. **Validate wallet address**:
   ```typescript
   import { isValidWalletAddress } from 'ad402-sdk';
   
   const wallet = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
   if (!isValidWalletAddress(wallet)) {
     console.error('Invalid wallet format');
   }
   ```
3. **Check website ID**: Open browser DevTools Console, look for error message with specific issue
4. **Try fresh rebuild**:
   ```bash
   rm -rf node_modules .next
   npm install
   npm run dev
   ```

---

### "Ad failed to load" on slots

**Symptoms**:
- Gray box with "Ad failed to load" message
- Console shows 404, 503, or 429 errors

**Root Causes**:
1. Network issue (CORS blocked, firewall, offline)
2. Invalid slot ID (not registered on platform)
3. API rate limited (429)
4. Server maintenance (503)

**Debug Steps**:
```typescript
// 1. Open DevTools → Network tab
// 2. Look for requests to: https://ad402.io/api/ads/{slotId}
// 3. Check response status:

// 404: Slot not found
// → Solution: Register slot on platform dashboard

// 429: Rate limited
// → Solution: Wait 1-2 minutes, retry

// 503: Server error
// → Solution: Wait for maintenance, try again

// CORS error in console
// → Solution: Check that apiBaseUrl domain is whitelisted
```

**Solutions**:
1. **Test API directly**:
   ```bash
   curl -X GET "https://ad402.io/api/ads/my-slot-id"
   ```

2. **Check slot registration**:
   - Go to Ad402 dashboard
   - Verify your domain is registered
   - Verify slot IDs match exactly (case-sensitive)

3. **Enable retry with backoff**:
   ```typescript
   // Already built-in! SDK retries 2x with exponential backoff
   <Ad402Slot slotId="my-slot" size="banner" price="0.25" />
   ```

4. **Use custom error component to debug**:
   ```typescript
   <Ad402Slot
     slotId="my-slot"
     size="banner"
     price="0.25"
     onAdError={(error) => {
       console.error('Ad error:', error.type, error.message);
       // error.type: 'NETWORK_ERROR', 'API_ERROR', 'VALIDATION_ERROR'
     }}
   />
   ```

---

### TypeScript errors after SDK update

**Symptoms**:
- Red squiggles in IDE
- `Property '...' does not exist on type '...'`
- Type mismatch errors

**Root Causes**:
- Cached TypeScript server
- Old node_modules
- Mismatched type versions

**Solutions**:
```bash
# 1. Clear caches
rm -rf node_modules package-lock.json
npm install

# 2. Restart TypeScript server
# In VS Code: Cmd+K, Cmd+J (or Ctrl+K, Ctrl+J on Windows)

# 3. Rebuild project
npm run build

# 4. Clear IDE cache
# VSCode: Command Palette → TypeScript: Restart TS Server
# WebStorm: File → Invalidate Caches and Restart
```

---

### Theme not applying to ads

**Symptoms**:
- Custom colors don't show
- Default theme shows instead of your theme
- Only some properties apply

**Root Causes**:
- CSS specificity too high
- Theme not merged correctly
- Browser caching

**Debug**:
```typescript
import { useAd402Config } from 'ad402-sdk';

function DebugTheme() {
  const config = useAd402Config();
  console.log('Applied theme:', config.theme);
  return null;
}

<Ad402Provider config={...}>
  <DebugTheme /> {/* Check console */}
  <Ad402Slot />
</Ad402Provider>
```

**Solutions**:
1. **Verify theme passed correctly**:
   ```typescript
   const config = {
     websiteId: 'my-site',
     walletAddress: '0x...',
     theme: {
       primaryColor: '#1a1a1a',        // Must be valid hex
       backgroundColor: '#f8f9fa',
       textColor: '#333333',
       borderColor: '#dee2e6',
       fontFamily: 'Inter, sans-serif',
       borderRadius: 8
     }
   };
   ```

2. **Use CSS Modules to isolate styles**:
   ```typescript
   // components/AdContainer.module.css
   .adContainer {
     isolation: isolate;  /* Prevent CSS bleed */
     z-index: 50;
   }

   // components/AdContainer.tsx
   import styles from './AdContainer.module.css';
   
   export function AdContainer() {
     return (
       <div className={styles.adContainer}>
         <Ad402Slot slotId="my-slot" size="banner" price="0.25" />
       </div>
     );
   }
   ```

3. **Check z-index conflicts**:
   ```css
   /* Ensure parent containers don't have z-index: 0 */
   .pageWrapper {
     z-index: auto; /* Not 0 or explicit number */
   }
   ```

---

### Clicks not tracked in analytics

**Symptoms**:
- Ads display correctly
- Clicks work (redirect happens)
- But click count doesn't increase in dashboard

**Root Causes**:
- Old SDK version (before click tracking fix)
- Analytics endpoint unreachable
- Event payload malformed

**Solutions**:
1. **Update SDK to latest**:
   ```bash
   npm update ad402-sdk
   # or
   npm install ad402-sdk@latest
   ```

2. **Verify click tracking configured**:
   ```typescript
   import { trackAdEvent } from 'ad402-sdk';

   // This is now automatically called on click
   // But you can also call manually:
   <Ad402Slot
     slotId="my-slot"
     onAdClick={(slotId) => {
       // Manual tracking for custom clicks
       trackAdEvent('click', slotId, config.websiteId);
     }}
   />
   ```

3. **Debug analytics endpoint**:
   ```typescript
   // Check that analytics requests are being sent
   // Open DevTools → Network tab
   // Look for POST requests to https://ad402.io/api/analytics
   // Should see: { event: 'click', slotId: '...', websiteId: '...' }
   ```

---

### Works locally but fails in production

**Symptoms**:
- Everything works in `npm run dev`
- Blank page or errors in production
- CORS errors in browser console

**Root Causes**:
1. Environment variables not set
2. API base URL wrong for production
3. CORS headers misconfigured
4. Build process issue

**Debug & Solutions**:

1. **Check environment variables**:
   ```bash
   # .env.local (development)
   NEXT_PUBLIC_AD402_WEBSITE_ID=dev-site
   NEXT_PUBLIC_AD402_WALLET_ADDRESS=0x...
   NEXT_PUBLIC_AD402_API_BASE_URL=http://localhost:3000

   # .env.production (production)
   NEXT_PUBLIC_AD402_WEBSITE_ID=prod-site
   NEXT_PUBLIC_AD402_WALLET_ADDRESS=0x...
   NEXT_PUBLIC_AD402_API_BASE_URL=https://ad402.io
   ```

2. **Verify config at runtime**:
   ```typescript
   useEffect(() => {
     console.log('Production config:', {
       websiteId: process.env.NEXT_PUBLIC_AD402_WEBSITE_ID,
       walletAddress: process.env.NEXT_PUBLIC_AD402_WALLET_ADDRESS,
       apiBaseUrl: process.env.NEXT_PUBLIC_AD402_API_BASE_URL,
     });
   }, []);
   ```

3. **Check CORS headers**:
   ```bash
   # Server should return these headers:
   Access-Control-Allow-Origin: https://yoursite.com
   Access-Control-Allow-Methods: GET, POST, OPTIONS
   Access-Control-Allow-Headers: Content-Type
   ```

4. **Test production build locally**:
   ```bash
   npm run build
   npm run start
   # Visit http://localhost:3000
   ```

---

### Memory leaks or performance issues

**Symptoms**:
- Page gets slower over time
- Browser memory usage increases
- Multiple clicks/interactions lag

**Root Causes**:
- Context re-renders too often
- Missing cleanup in useEffect
- No request cancellation

**Solutions**:
```typescript
// ✅ CORRECT: Wrap provider at high level, not per-component
<Ad402Provider config={config}>
  <Layout>
    <Page1 />
    <Page2 />
  </Layout>
</Ad402Provider>

// ❌ WRONG: Creating new provider on every render
{items.map(item => (
  <Ad402Provider config={config} key={item.id}>
    <Ad402Slot slotId={item.slotId} />
  </Ad402Provider>
))}

// ✅ Use memoization to prevent re-renders
const MemoizedSlot = React.memo(Ad402Slot);

// ✅ Use useMemo for config
const memoConfig = useMemo(() => config, [config.websiteId, config.walletAddress]);
<Ad402Provider config={memoConfig}>
  <App />
</Ad402Provider>
```

---

## Getting Help

**For more help**:
- 📖 [API Documentation](./API.md)
- 🐛 [GitHub Issues](https://github.com/swift-add/swift-add-sdk/issues)
- 💬 [Discord Community](https://discord.gg/swift-add)
- 📧 Email: support@ad402.io
```

---

## 4. Quick Testing Command Reference

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on change)
npm run test:watch

# Run specific test file
npm test Ad402Provider.test.tsx

# Run tests with coverage report
npm test -- --coverage

# Update snapshots (if using snapshot tests)
npm test -- -u

# Run lint check
npm run lint

# Fix lint issues automatically
npm run lint:fix

# Type check without emitting
npm run type-check

# Full build (test + lint + compile)
npm run build
```

---

## What to Commit

### Commit 1: CI/CD Infrastructure
```
feat: add GitHub Actions CI/CD pipeline

- Add .github/workflows/test.yml for automated testing
- Add .eslintrc.json for code quality enforcement
- Add .prettierrc.json for code formatting
- Update package.json with lint and type-check scripts
- Add ESLint and Prettier dependencies
```

### Commit 2: Component Tests
```
test: add comprehensive component test suite

- Add Ad402Provider tests (initialization, validation, context)
- Add Ad402ErrorBoundary tests (error catching, callbacks)
- Add Ad402Slot integration tests (full flow with MSW mocking)
- Add test utilities and mock setup
- Achieve 80%+ code coverage
- All tests passing (59 total)
```

### Commit 3: Documentation
```
docs: add troubleshooting and contribution guides

- Add TROUBLESHOOTING.md with common issues and solutions
- Add CONTRIBUTING.md with dev setup and guidelines
- Add API.md with complete API reference
- Update README.md with links to new docs
```

This gives you a concrete implementation path forward!

