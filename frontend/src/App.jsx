import { useState, useEffect, useRef } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import * as SorobanRpc from '@stellar/stellar-sdk/rpc';
import * as freighterApi from '@stellar/freighter-api';
import './App.css';

const { Contract, TransactionBuilder, Networks, BASE_FEE, Address, nativeToScVal, scValToNative } = StellarSdk;

const CONTRACT_ID = 'CDVKXMYN2STPUCCUY742YSNHTM3KJFPPJIW3CKMS7N6SIS3IWKHXS3RJ';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const RPC_URL = 'https://soroban-testnet.stellar.org';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 4 + 2,
  speed: Math.random() * 2 + 1,
  opacity: Math.random() * 0.5 + 0.2,
}));

const App = () => {
  const [publicKey, setPublicKey] = useState(null);
  const [balance, setBalance] = useState('0');
  const [streamCount, setStreamCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('create');
  const [receiver, setReceiver] = useState('');
  const [rate, setRate] = useState('');
  const [duration, setDuration] = useState('');
  const [deposit, setDeposit] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [liveCounter, setLiveCounter] = useState(0);
  const [particles, setParticles] = useState(PARTICLES);
  const counterRef = useRef(null);

  useEffect(() => {
    if (rate && isSending === false && txHash) {
      counterRef.current = setInterval(() => {
        setLiveCounter(prev => prev + parseInt(rate));
      }, 1000);
    }
    return () => clearInterval(counterRef.current);
  }, [rate, txHash, isSending]);

  useEffect(() => {
    const interval = setInterval(() => {
      setParticles(prev => prev.map(p => ({
        ...p,
        y: p.y - p.speed * 0.1 < 0 ? 100 : p.y - p.speed * 0.1,
      })));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const connectWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      const connected = await freighterApi.isConnected();
      if (!connected || !connected.isConnected) {
        setError('Please install Freighter wallet!');
        return;
      }
      await freighterApi.requestAccess();
      const addressResult = await freighterApi.getAddress();
      const pubKey = addressResult.address || addressResult;
      setPublicKey(pubKey);
      await fetchBalance(pubKey);
      setSuccess('Wallet connected!');
    } catch (err) {
      setError('Connection failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async (address) => {
    try {
      const response = await fetch(`${HORIZON_URL}/accounts/${address}`);
      const data = await response.json();
      const xlm = data.balances?.find(b => b.asset_type === 'native');
      setBalance(xlm ? parseFloat(xlm.balance).toFixed(2) : '0');
    } catch (err) {
      console.log('Balance error:', err.message);
    }
  };

  const disconnectWallet = () => {
    setPublicKey(null);
    setBalance('0');
    setStreamCount(0);
    setSuccess(null);
    setError(null);
    setReceiver('');
    setRate('');
    setDuration('');
    setDeposit('');
    setTxHash(null);
    setLiveCounter(0);
  };

  const createStream = async () => {
    if (!receiver || !rate || !duration || !deposit) {
      setError('Please fill all fields!');
      return;
    }
    setIsSending(true);
    setError(null);
    setSuccess(null);
    setTxHash(null);

    try {
      const server = new SorobanRpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const sourceAccount = await server.getAccount(publicKey);

      const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call(
          'create_stream',
          Address.fromString(publicKey).toScVal(),
          Address.fromString(receiver).toScVal(),
          nativeToScVal(parseInt(rate), { type: 'i128' }),
          nativeToScVal(parseInt(duration), { type: 'u64' }),
          nativeToScVal(parseInt(deposit), { type: 'i128' }),
        ))
        .setTimeout(180)
        .build();

      const simResult = await server.simulateTransaction(tx);
      if (simResult.error) throw new Error('Simulation failed: ' + simResult.error);

      const cloned = TransactionBuilder.cloneFrom(tx);
      cloned.setMinFee(simResult.minResourceFee);
      const finalTx = cloned.build();

      const xdr = finalTx.toEnvelope().toXDR('base64');
      const signResult = await freighterApi.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      const signedXdr = signResult.signedTxXdr || signResult;
      const txEnvelope = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      const result = await server.sendTransaction(txEnvelope);

      setTxHash(result.hash);
      setSuccess('🎉 Stream created successfully!');
      setLiveCounter(0);
      await fetchBalance(publicKey);
      setReceiver('');
      setRate('');
      setDuration('');
      setDeposit('');
    } catch (err) {
      setError('Failed: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const getStreamCount = async () => {
    try {
      const server = new SorobanRpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const sourceAccount = await server.getAccount(publicKey);
      const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(contract.call('get_stream_count'))
        .setTimeout(30)
        .build();
      const result = await server.simulateTransaction(tx);
      if (result.result) {
        const count = scValToNative(result.result.retval);
        setStreamCount(Number(count));
      }
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    if (publicKey) {
      const interval = setInterval(() => fetchBalance(publicKey), 15000);
      getStreamCount();
      return () => clearInterval(interval);
    }
  }, [publicKey]);

  return (
    <div className="app">
      {/* Animated Background */}
      <div className="bg-animation">
        {particles.map(p => (
          <div key={p.id} className="particle" style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
          }} />
        ))}
        <div className="bg-orb orb1" />
        <div className="bg-orb orb2" />
        <div className="bg-orb orb3" />
      </div>

      {/* Header */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">💧</div>
          <div className="logo-text">
            <h1>StellarFlow</h1>
            <span>Payment Streams</span>
          </div>
        </div>

        {publicKey && (
          <div className="wallet-info">
            <div className="wallet-badge">
              <div className="status-dot" />
              <span className="wallet-addr">{publicKey.slice(0, 6)}...{publicKey.slice(-4)}</span>
            </div>
            <div className="balance-chip">
              <span className="balance-icon">⭐</span>
              <span>{balance} XLM</span>
            </div>
            <button onClick={disconnectWallet} className="btn-disconnect">
              Disconnect
            </button>
          </div>
        )}
      </header>

      <main className="main">
        {/* Alerts */}
        {error && (
          <div className="alert alert-error">
            <span>❌</span>
            <span>{error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            <span>✅</span>
            <span>{success}</span>
            <button onClick={() => setSuccess(null)}>✕</button>
          </div>
        )}

        {!publicKey ? (
          /* Landing Page */
          <div className="landing">
            <div className="hero">
              <div className="hero-badge">🚀 Built on Stellar Testnet</div>
              <h2 className="hero-title">
                Stream Money<br />
                <span className="gradient-text">Like Water</span>
              </h2>
              <p className="hero-subtitle">
                Real-time continuous payment streaming powered by Soroban smart contracts.
                Pay per second, subscribe per minute, vest per hour.
              </p>

              <div className="feature-grid">
                <div className="feature-card">
                  <div className="feature-icon">⚡</div>
                  <h4>Real-time</h4>
                  <p>XLM flows every second</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🔒</div>
                  <h4>Secure</h4>
                  <p>Soroban smart contracts</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">⏸️</div>
                  <h4>Flexible</h4>
                  <p>Cancel anytime</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">💰</div>
                  <h4>Any Amount</h4>
                  <p>Custom rate & duration</p>
                </div>
              </div>

              <div className="use-cases">
                <div className="use-case">💼 Salary Streaming</div>
                <div className="use-case">🎨 Creator Subscriptions</div>
                <div className="use-case">📈 Token Vesting</div>
                <div className="use-case">🔧 Freelance Payments</div>
              </div>

              <button onClick={connectWallet} disabled={loading} className="btn-connect">
                {loading ? (
                  <span className="loading-spinner">⏳ Connecting...</span>
                ) : (
                  <>
                    <span>🔗</span>
                    <span>Connect Freighter Wallet</span>
                  </>
                )}
              </button>

              <p className="hero-note">
                ⚠️ Testnet only — No real funds involved
              </p>
            </div>

            {/* Stats */}
            <div className="stats-bar">
              <div className="stat-item">
                <span className="stat-num">∞</span>
                <span className="stat-label">Streams Possible</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-num">1s</span>
                <span className="stat-label">Min Interval</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-num">0%</span>
                <span className="stat-label">Platform Fee</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <span className="stat-num">100%</span>
                <span className="stat-label">On-chain</span>
              </div>
            </div>
          </div>
        ) : (
          /* Dashboard */
          <div className="dashboard">
            {/* Stats Row */}
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-icon">💰</div>
                <div className="stat-content">
                  <span className="stat-label">Balance</span>
                  <span className="stat-value">{balance} XLM</span>
                </div>
              </div>
              <div className="stat-card" onClick={getStreamCount} style={{cursor:'pointer'}}>
                <div className="stat-icon">🌊</div>
                <div className="stat-content">
                  <span className="stat-label">Total Streams</span>
                  <span className="stat-value">{streamCount}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📍</div>
                <div className="stat-content">
                  <span className="stat-label">Network</span>
                  <span className="stat-value">Testnet</span>
                </div>
              </div>
              {txHash && (
                <div className="stat-card live-card">
                  <div className="stat-icon">💧</div>
                  <div className="stat-content">
                    <span className="stat-label">Streamed</span>
                    <span className="stat-value live-num">{liveCounter} stroops</span>
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="tabs">
              {['create', 'how', 'contract'].map(tab => (
                <button
                  key={tab}
                  className={`tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'create' && '➕ Create Stream'}
                  {tab === 'how' && 'ℹ️ How It Works'}
                  {tab === 'contract' && '📄 Contract'}
                </button>
              ))}
            </div>

            {/* Create Stream Tab */}
            {activeTab === 'create' && (
              <div className="card create-card">
                <div className="card-header">
                  <h2>💧 Create Payment Stream</h2>
                  <p>Set up a continuous XLM payment stream</p>
                </div>

                <div className="form">
                  <div className="form-group">
                    <label htmlFor="receiver">
                      <span>📬</span> Receiver Address
                    </label>
                    <input
                      id="receiver"
                      type="text"
                      placeholder="G... (Stellar public key)"
                      value={receiver}
                      onChange={e => setReceiver(e.target.value)}
                      disabled={isSending}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="rate">
                        <span>⚡</span> Rate (stroops/sec)
                      </label>
                      <input
                        id="rate"
                        type="number"
                        placeholder="e.g. 10"
                        value={rate}
                        onChange={e => setRate(e.target.value)}
                        disabled={isSending}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="duration">
                        <span>⏱️</span> Duration (seconds)
                      </label>
                      <input
                        id="duration"
                        type="number"
                        placeholder="e.g. 3600"
                        value={duration}
                        onChange={e => setDuration(e.target.value)}
                        disabled={isSending}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="deposit">
                      <span>💎</span> Total Deposit (stroops)
                    </label>
                    <input
                      id="deposit"
                      type="number"
                      placeholder="e.g. 36000"
                      value={deposit}
                      onChange={e => setDeposit(e.target.value)}
                      disabled={isSending}
                    />
                  </div>

                  {rate && duration && deposit && (
                    <div className="stream-preview">
                      <div className="preview-row">
                        <span>💧 Rate</span>
                        <span>{rate} stroops/sec</span>
                      </div>
                      <div className="preview-row">
                        <span>⏱️ Duration</span>
                        <span>{Math.floor(duration/3600)}h {Math.floor((duration%3600)/60)}m {duration%60}s</span>
                      </div>
                      <div className="preview-row">
                        <span>💰 Total</span>
                        <span>{rate * duration} stroops</span>
                      </div>
                      <div className="preview-row highlight">
                        <span>🎯 XLM Amount</span>
                        <span>{(rate * duration / 10000000).toFixed(7)} XLM</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={createStream}
                    disabled={isSending || !receiver || !rate || !duration || !deposit}
                    className="btn-create"
                  >
                    {isSending ? (
                      <span className="btn-loading">
                        <span className="spinner" />
                        Creating Stream...
                      </span>
                    ) : (
                      <span>💧 Create Stream</span>
                    )}
                  </button>
                </div>

                {txHash && (
                  <div className="tx-success">
                    <div className="tx-header">
                      <span className="tx-icon">🎉</span>
                      <h3>Stream Created!</h3>
                    </div>
                    <div className="tx-hash">
                      <span>TX Hash:</span>
                      <code>{txHash.slice(0, 20)}...{txHash.slice(-10)}</code>
                    </div>
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-explorer"
                    >
                      🔍 View on Stellar Expert
                    </a>
                    <div className="live-stream">
                      <div className="stream-animation">
                        <div className="drop d1">💧</div>
                        <div className="drop d2">💧</div>
                        <div className="drop d3">💧</div>
                      </div>
                      <p>Stream is active — <strong>{liveCounter} stroops</strong> streamed</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* How It Works Tab */}
            {activeTab === 'how' && (
              <div className="card">
                <div className="card-header">
                  <h2>ℹ️ How StellarFlow Works</h2>
                  <p>Simple, transparent, on-chain payment streaming</p>
                </div>
                <div className="steps">
                  {[
                    { num: '01', icon: '🔗', title: 'Connect Wallet', desc: 'Connect your Freighter wallet on Stellar Testnet' },
                    { num: '02', icon: '⚙️', title: 'Configure Stream', desc: 'Set receiver address, rate per second, duration, and deposit amount' },
                    { num: '03', icon: '✍️', title: 'Sign & Deploy', desc: 'Sign the Soroban contract transaction with Freighter' },
                    { num: '04', icon: '💧', title: 'Money Flows', desc: 'XLM streams continuously to receiver every second on-chain' },
                    { num: '05', icon: '💰', title: 'Withdraw Anytime', desc: 'Receiver can withdraw accrued balance whenever they want' },
                    { num: '06', icon: '🛑', title: 'Cancel Anytime', desc: 'Sender can cancel the stream to stop future payments' },
                  ].map(step => (
                    <div key={step.num} className="step">
                      <div className="step-num">{step.num}</div>
                      <div className="step-icon">{step.icon}</div>
                      <div className="step-content">
                        <h4>{step.title}</h4>
                        <p>{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contract Tab */}
            {activeTab === 'contract' && (
              <div className="card">
                <div className="card-header">
                  <h2>📄 Contract Info</h2>
                  <p>Deployed on Stellar Testnet</p>
                </div>
                <div className="contract-info">
                  <div className="info-row">
                    <span>Contract ID</span>
                    <code className="contract-id">{CONTRACT_ID}</code>
                  </div>
                  <div className="info-row">
                    <span>Network</span>
                    <span className="badge-testnet">Testnet</span>
                  </div>
                  <div className="info-row">
                    <span>Explorer</span>
                    <a
                      href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-explorer"
                    >
                      View on Stellar Expert →
                    </a>
                  </div>
                </div>
                <div className="functions-list">
                  <h3>Contract Functions</h3>
                  {[
                    { name: 'create_stream', desc: 'Create a new payment stream' },
                    { name: 'withdrawable', desc: 'Check withdrawable balance' },
                    { name: 'withdraw', desc: 'Withdraw accrued funds' },
                    { name: 'cancel_stream', desc: 'Cancel an active stream' },
                    { name: 'get_stream', desc: 'Get stream details' },
                    { name: 'get_stream_count', desc: 'Get total stream count' },
                  ].map(fn => (
                    <div key={fn.name} className="fn-row">
                      <code className="fn-name">{fn.name}</code>
                      <span className="fn-desc">{fn.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-logo">💧 StellarFlow</div>
          <div className="footer-links">
            <a href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`} target="_blank" rel="noopener noreferrer">Contract</a>
            <a href="https://www.freighter.app" target="_blank" rel="noopener noreferrer">Freighter</a>
            <a href="https://stellar.org" target="_blank" rel="noopener noreferrer">Stellar</a>
          </div>
          <div className="footer-note">Built for Stellar Black Belt Challenge 🥋</div>
        </div>
      </footer>
    </div>
  );
};

export default App;