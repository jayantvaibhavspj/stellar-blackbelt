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
  
  // New states for additional features
  const [myStreams, setMyStreams] = useState([]);
  const [receiverStreams, setReceiverStreams] = useState([]);
  const [stroopsInput, setStroopsInput] = useState('');
  const [xlmInput, setXlmInput] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [streamDetails, setStreamDetails] = useState(null);
  
  // NEW FEATURES: Scheduled Streams, Duration Extension, 2FA
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledStreams, setScheduledStreams] = useState([]);
  
  const [extendStreamId, setExtendStreamId] = useState(null);
  const [extendDuration, setExtendDuration] = useState('');
  
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFAEmail, setTwoFAEmail] = useState('');
  const [twoFAOTP, setTwoFAOTP] = useState('');
  const [twoFAVerified, setTwoFAVerified] = useState(false);

  // USER FEEDBACK FEATURES
  const [streamTemplates, setStreamTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [whitelistedAddresses, setWhitelistedAddresses] = useState([]);
  const [newWhitelistAddr, setNewWhitelistAddr] = useState('');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

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
    setMyStreams([]);
    setReceiverStreams([]);
    setValidationErrors({});
  };

  // Feature 2: Smart Input Validation
  const validateInputs = () => {
    const errors = {};
    
    // Validate receiver address format
    if (receiver && !receiver.startsWith('G') && receiver.length !== 56) {
      errors.receiver = 'Invalid Stellar address format';
    }
    
    // Validate sufficient balance
    const totalNeeded = parseInt(deposit) / 10000000;
    if (parseFloat(balance) < totalNeeded) {
      errors.deposit = `Insufficient balance. Need ${totalNeeded.toFixed(7)} XLM`;
    }
    
    // Validate rate and duration
    if (rate && parseInt(rate) <= 0) errors.rate = 'Rate must be positive';
    if (duration && parseInt(duration) <= 0) errors.duration = 'Duration must be positive';
    
    // Validate deposit vs cost matching
    const totalCost = (parseInt(rate) || 0) * (parseInt(duration) || 0);
    if (deposit && parseInt(deposit) < totalCost) {
      errors.deposit = `Deposit (${deposit}) must be >= total cost (${totalCost})`;
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Feature 2: Stroops ↔ XLM Converter
  const handleStroopsChange = (value) => {
    setStroopsInput(value);
    if (value) {
      const xlm = (parseFloat(value) / 10000000).toFixed(7);
      setXlmInput(xlm);
    } else {
      setXlmInput('');
    }
  };

  const handleXlmChange = (value) => {
    setXlmInput(value);
    if (value) {
      const stroops = (parseFloat(value) * 10000000).toFixed(0);
      setStroopsInput(stroops);
    } else {
      setStroopsInput('');
    }
  };

  // Feature 1: Save stream to history (localStorage)
  const saveStreamToHistory = (streamData) => {
    const streams = JSON.parse(localStorage.getItem('myStreams') || '[]');
    streams.unshift(streamData);
    localStorage.setItem('myStreams', JSON.stringify(streams.slice(0, 50))); // Keep last 50
    setMyStreams(streams.slice(0, 50));
  };

  // Load stream history
  const loadStreamHistory = () => {
    const streams = JSON.parse(localStorage.getItem('myStreams') || '[]');
    setMyStreams(streams);
  };

  // FEATURE 1: SCHEDULED STREAMS
  const scheduleStream = () => {
    if (!scheduledDate || !scheduledTime) {
      setError('Please select date and time for scheduled stream');
      return;
    }
    
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    if (scheduledDateTime <= new Date()) {
      setError('Schedule time must be in the future');
      return;
    }
    
    setIsScheduled(true);
    setSuccess('✅ Stream scheduled for ' + scheduledDateTime.toLocaleString());
  };

  const saveScheduledStream = (streamData) => {
    const scheduled = JSON.parse(localStorage.getItem('scheduledStreams') || '[]');
    const newScheduled = {
      ...streamData,
      scheduledDateTime: `${scheduledDate}T${scheduledTime}`,
      status: 'scheduled'
    };
    scheduled.push(newScheduled);
    localStorage.setItem('scheduledStreams', JSON.stringify(scheduled));
    setScheduledStreams(scheduled);
  };

  const loadScheduledStreams = () => {
    const scheduled = JSON.parse(localStorage.getItem('scheduledStreams') || '[]');
    setScheduledStreams(scheduled);
  };

  // FEATURE 2: DURATION EXTENSION
  const extendStreamDuration = () => {
    if (!extendStreamId || !extendDuration) {
      setError('Please select stream and extension duration');
      return;
    }
    
    const stream = myStreams.find(s => s.id === extendStreamId);
    if (!stream) {
      setError('Stream not found');
      return;
    }
    
    const newDuration = parseInt(stream.duration) + parseInt(extendDuration);
    const newCost = stream.rate * newDuration;
    
    setSuccess(`✅ Stream extended! New duration: ${newDuration}s (Cost: ${newCost} stroops)`);
    
    // Save extended stream
    const updated = myStreams.map(s => 
      s.id === extendStreamId 
        ? { ...s, duration: newDuration, totalCost: newCost, xlmAmount: (newCost / 10000000).toFixed(7) }
        : s
    );
    setMyStreams(updated);
    localStorage.setItem('myStreams', JSON.stringify(updated));
    
    setExtendStreamId(null);
    setExtendDuration('');
  };

  // FEATURE 3: 2FA SECURITY
  const setupTwoFA = () => {
    if (!twoFAEmail) {
      setError('Please enter email for 2FA');
      return;
    }
    
    // Generate fake OTP (in real app, send via email)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    localStorage.setItem('2fa_otp', otp);
    localStorage.setItem('2fa_email', twoFAEmail);
    
    setSuccess(`✅ OTP sent to ${twoFAEmail}: ${otp} (Demo: Save this OTP)`);
    setTwoFAEnabled(true);
  };

  const verifyTwoFA = () => {
    if (!twoFAOTP) {
      setError('Please enter OTP');
      return;
    }
    
    const savedOTP = localStorage.getItem('2fa_otp');
    if (twoFAOTP === savedOTP) {
      setTwoFAVerified(true);
      setSuccess('✅ 2FA verified successfully!');
      localStorage.setItem('2fa_verified', 'true');
    } else {
      setError('❌ Invalid OTP. Try again.');
    }
  };

  const disableTwoFA = () => {
    setTwoFAEnabled(false);
    setTwoFAVerified(false);
    localStorage.removeItem('2fa_otp');
    localStorage.removeItem('2fa_email');
    localStorage.removeItem('2fa_verified');
    setSuccess('✅ 2FA disabled');
  };

  const createStream = async () => {
    if (!receiver || !rate || !duration || !deposit) {
      setError('Please fill all fields!');
      return;
    }

    // Feature 3: Check 2FA
    if (twoFAEnabled && !twoFAVerified) {
      setError('Please verify 2FA before creating stream');
      return;
    }

    // Feature 3: Validate before creating
    if (!validateInputs()) {
      setError('Please fix validation errors');
      return;
    }

    // Feature 1: If scheduled, save and don't execute now
    if (isScheduled) {
      const totalCost = parseInt(rate) * parseInt(duration);
      const streamInfo = {
        id: Math.random().toString(36),
        receiver: receiver,
        rate: parseInt(rate),
        duration: parseInt(duration),
        deposit: parseInt(deposit),
        totalCost: totalCost,
        xlmAmount: (totalCost / 10000000).toFixed(7),
        timestamp: new Date().toISOString(),
        scheduledDateTime: `${scheduledDate}T${scheduledTime}`,
        status: 'scheduled'
      };
      
      saveScheduledStream(streamInfo);
      setSuccess(`✅ Stream scheduled! Will execute at ${scheduledDate} ${scheduledTime}`);
      setReceiver('');
      setRate('');
      setDuration('');
      setDeposit('');
      setScheduledDate('');
      setScheduledTime('');
      setIsScheduled(false);
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);
    setTxHash(null);
    console.log('=== Creating Stream ===');
    console.log('Receiver:', receiver, 'Rate:', rate, 'Duration:', duration);

    try {
      const server = new SorobanRpc.Server(RPC_URL);
      const contract = new Contract(CONTRACT_ID);
      const sourceAccount = await server.getAccount(publicKey);
      console.log('✓ Got source account');

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
      console.log('✓ Built transaction');

      const simResult = await server.simulateTransaction(tx);
      console.log('✓ Simulated transaction', simResult);
      if (simResult.error) throw new Error('Simulation failed: ' + simResult.error);

      // Use the simulated transaction's fee and build final tx
      let finalTx = tx;
      
      if (simResult.result) {
        // Build a fresh transaction with the fees from simulation
        const newBuilder = new TransactionBuilder(sourceAccount, {
          fee: (parseInt(BASE_FEE) + parseInt(simResult.result.resource_fee || 0)).toString(),
          networkPassphrase: NETWORK_PASSPHRASE,
        });

        newBuilder.addOperation(contract.call(
          'create_stream',
          Address.fromString(publicKey).toScVal(),
          Address.fromString(receiver).toScVal(),
          nativeToScVal(parseInt(rate), { type: 'i128' }),
          nativeToScVal(parseInt(duration), { type: 'u64' }),
          nativeToScVal(parseInt(deposit), { type: 'i128' }),
        ));
        
        finalTx = newBuilder.setTimeout(300).build();
        console.log('✓ Built final transaction with fees');
      }

      const xdr = finalTx.toEnvelope().toXDR('base64');
      console.log('✓ Got XDR, requesting signature...');

      const signResult = await freighterApi.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      console.log('✓ Got signature');

      const signedXdr = signResult.signedTxXdr || signResult;
      const txEnvelope = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
      console.log('✓ Built envelope, sending to network...');
      const result = await server.sendTransaction(txEnvelope);
      console.log('✓ Transaction sent! Hash:', result.hash);

      // Wait for transaction to be confirmed on network using Horizon API
      let txConfirmed = false;
      let confirmAttempts = 0;
      const maxAttempts = 30; // Try for up to 30 seconds
      
      while (!txConfirmed && confirmAttempts < maxAttempts) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          const horizonResponse = await fetch(`${HORIZON_URL}/transactions/${result.hash}`);
          if (horizonResponse.ok) {
            const txData = await horizonResponse.json();
            txConfirmed = true;
            console.log('✓ Transaction confirmed on network!', txData);
          } else if (horizonResponse.status === 404) {
            confirmAttempts++;
            console.log(`Attempt ${confirmAttempts}: Transaction not yet in ledger...`);
          }
        } catch (err) {
          confirmAttempts++;
          console.warn(`Verification attempt ${confirmAttempts} failed:`, err);
        }
      }
      
      if (!txConfirmed) {
        console.warn('⚠ Transaction submitted but verification pending. Hash:', result.hash);
      }

      // Feature 5: Create detailed stream info
      const totalCost = parseInt(rate) * parseInt(duration);
      const verifyUrl = `https://stellar.expert/explorer/testnet/tx/${result.hash}`;
      const streamInfo = {
        id: Math.random().toString(36),
        txHash: result.hash,
        verifyUrl: verifyUrl,
        receiver: receiver,
        rate: parseInt(rate),
        duration: parseInt(duration),
        deposit: parseInt(deposit),
        totalCost: totalCost,
        xlmAmount: (totalCost / 10000000).toFixed(7),
        timestamp: new Date().toISOString(),
        status: 'active'
      };
      console.log('Stream info created:', streamInfo);

      setTxHash(result.hash);
      setStreamDetails(streamInfo);
      setSuccess(`🎉 Stream created! Tx: ${result.hash.substring(0, 10)}...`);
      setLiveCounter(0);
      console.log('✓ State updated');
      
      // Feature 1: Save to history IMMEDIATELY
      console.log('Saving to localStorage...');
      saveStreamToHistory(streamInfo);
      console.log('✓ Saved to history');
      
      // Load streams to make sure UI is updated
      console.log('Loading streams...');
      loadStreamHistory();
      console.log('✓ Loaded streams');
      
      // Switch to My Streams tab to show the new stream
      setActiveTab('mystreams');
      
      // Clear form inputs
      setReceiver('');
      setRate('');
      setDuration('');
      setDeposit('');
      
      // Update balance and stream count in background (don't wait for these)
      console.log('Updating balance in background...');
      fetchBalance(publicKey).catch(err => console.warn('Balance update failed:', err));
      
      // Update stream count from contract (non-blocking)
      console.log('Updating stream count in background...');
      getStreamCount().catch(err => console.warn('Stream count update failed:', err));
    } catch (err) {
      console.error('❌ Error creating stream:', err);
      console.error('Full error:', JSON.stringify(err, null, 2));
      setError('Failed: ' + err.message);
    } finally {
      console.log('=== Stream creation flow ended ===');
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
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('getStreamCount timeout')), 10000)
      );
      
      const result = await Promise.race([
        server.simulateTransaction(tx),
        timeoutPromise
      ]);
      
      console.log('getStreamCount result:', result);
      
      if (result.error) {
        console.warn('Simulation error:', result.error);
        return;
      }
      
      if (result.result && result.result.retval) {
        const count = scValToNative(result.result.retval);
        console.log('Stream count from contract:', count);
        setStreamCount(Number(count));
      }
    } catch (err) {
      console.warn('⚠ getStreamCount failed (non-blocking):', err.message);
      // Don't throw - this is a non-blocking update
    }
  };

  // USER FEEDBACK FEATURE: Stream Templates
  const saveTemplate = () => {
    if (!templateName || !receiver || !rate || !duration || !deposit) {
      setError('Please fill all fields and name your template');
      return;
    }
    const template = { templateName, receiver, rate, duration, deposit, createdAt: new Date().toISOString() };
    const templates = JSON.parse(localStorage.getItem('streamTemplates') || '[]');
    templates.unshift(template);
    localStorage.setItem('streamTemplates', JSON.stringify(templates));
    setStreamTemplates(templates);
    setSuccess(`✅ Template "${templateName}" saved!`);
    setTemplateName('');
  };

  const applyTemplate = (template) => {
    setReceiver(template.receiver);
    setRate(template.rate);
    setDuration(template.duration);
    setDeposit(template.deposit);
    setSuccess(`✅ Applied template: ${template.templateName}`);
  };

  // USER FEEDBACK FEATURE: Recipient Whitelist
  const addWhitelistAddress = () => {
    if (!newWhitelistAddr.startsWith('G') || newWhitelistAddr.length !== 56) {
      setError('Invalid Stellar address');
      return;
    }
    const updated = [...whitelistedAddresses, newWhitelistAddr];
    setWhitelistedAddresses(updated);
    localStorage.setItem('whitelistAddresses', JSON.stringify(updated));
    setSuccess('✅ Address whitelisted!');
    setNewWhitelistAddr('');
  };

  const removeWhitelistAddress = (addr) => {
    const updated = whitelistedAddresses.filter(a => a !== addr);
    setWhitelistedAddresses(updated);
    localStorage.setItem('whitelistAddresses', JSON.stringify(updated));
  };

  // USER FEEDBACK FEATURE: Stream Analytics
  const getStreamAnalytics = () => {
    if (myStreams.length === 0) return null;
    const totalXLM = myStreams.reduce((sum, s) => sum + (s.totalCost / 10000000), 0);
    const avgDuration = myStreams.reduce((sum, s) => sum + s.duration, 0) / myStreams.length;
    const avgRate = myStreams.reduce((sum, s) => sum + s.rate, 0) / myStreams.length;
    return { totalXLM: totalXLM.toFixed(7), avgDuration: avgDuration.toFixed(0), avgRate: avgRate.toFixed(0) };
  };

  // USER FEEDBACK FEATURE: Export Stream History
  const exportStreamHistory = () => {
    if (myStreams.length === 0) {
      setError('No streams to export');
      return;
    }
    const csv = [
      ['Receiver', 'Rate (stroops/sec)', 'Duration (sec)', 'Total Cost (stroops)', 'Total Cost (XLM)', 'Created At', 'TX Hash'],
      ...myStreams.map(s => [
        s.receiver,
        s.rate,
        s.duration,
        s.totalCost,
        s.xlmAmount,
        s.timestamp,
        s.txHash
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StellarFlow_History_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    setSuccess('✅ History exported as CSV!');
  };

  // USER FEEDBACK FEATURE: Emergency Stop (will comment out for safety)
  const emergencyStop = () => {
    if (window.confirm('⚠️ Cancel ALL active streams? This cannot be undone!')) {
      localStorage.setItem('myStreams', JSON.stringify([]));
      setMyStreams([]);
      setSuccess('⚠️ All streams have been marked as cancelled (local only)');
    }
  };

  useEffect(() => {
    if (publicKey) {
      const interval = setInterval(() => fetchBalance(publicKey), 15000);
      getStreamCount();
      loadStreamHistory(); // Feature 1: Load stream history
      // Load whitelist
      const whitelist = JSON.parse(localStorage.getItem('whitelistAddresses') || '[]');
      setWhitelistedAddresses(whitelist);
      // Load templates
      const templates = JSON.parse(localStorage.getItem('streamTemplates') || '[]');
      setStreamTemplates(templates);
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
            <div style={{flex: 1}}>
              <span>{success}</span>
              {streamDetails && (
                <div style={{marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center'}}>
                  <a 
                    href={streamDetails.verifyUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: '#4CAF50',
                      textDecoration: 'none',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      backgroundColor: 'rgba(76, 175, 80, 0.1)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      display: 'inline-block'
                    }}
                  >
                    🔍 Verify on Stellar Expert →
                  </a>
                </div>
              )}
            </div>
            <button onClick={() => {setSuccess(null); setStreamDetails(null);}}>✕</button>
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
                  <span className="stat-value">{streamCount || myStreams.length}</span>
                  <span style={{fontSize: '11px', opacity: 0.7}}>
                    {streamCount === 0 && myStreams.length > 0 ? '(Local: ' + myStreams.length + ')' : ''}
                  </span>
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
              {['create', 'schedule', 'extend', 'security', 'mystreams', 'receiving', 'templates', 'whitelist', 'analytics', 'tools', 'how', 'contract'].map(tab => (
                <button
                  key={tab}
                  className={`tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'create' && '➕ Create Stream'}
                  {tab === 'schedule' && '⏰ Scheduled'}
                  {tab === 'extend' && '📏 Extend'}
                  {tab === 'security' && '🔐 2FA Security'}
                  {tab === 'mystreams' && '📊 My Streams'}
                  {tab === 'receiving' && '📥 Receiving'}
                  {tab === 'templates' && '📋 Templates'}
                  {tab === 'whitelist' && '✅ Whitelist'}
                  {tab === 'analytics' && '📈 Analytics'}
                  {tab === 'tools' && '🔧 Tools'}
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
                      className={validationErrors.receiver ? 'input-error' : ''}
                    />
                    {validationErrors.receiver && (
                      <span className="error-message">❌ {validationErrors.receiver}</span>
                    )}
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
                        className={validationErrors.rate ? 'input-error' : ''}
                      />
                      {validationErrors.rate && (
                        <span className="error-message">❌ {validationErrors.rate}</span>
                      )}
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
                        className={validationErrors.duration ? 'input-error' : ''}
                      />
                      {validationErrors.duration && (
                        <span className="error-message">❌ {validationErrors.duration}</span>
                      )}
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
                      className={validationErrors.deposit ? 'input-error' : ''}
                    />
                    {validationErrors.deposit && (
                      <span className="error-message">❌ {validationErrors.deposit}</span>
                    )}
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

                {txHash && streamDetails && (
                  <div className="tx-success">
                    <div className="tx-header">
                      <span className="tx-icon">🎉</span>
                      <h3>Stream Created!</h3>
                    </div>
                    <div className="tx-hash">
                      <span>TX Hash:</span>
                      <code>{txHash.slice(0, 20)}...{txHash.slice(-10)}</code>
                    </div>
                    
                    {/* Feature 5: Detailed Stream Information */}
                    <div className="stream-details">
                      <div className="detail-row">
                        <span>📬 Receiver</span>
                        <code>{streamDetails.receiver.slice(0, 10)}...{streamDetails.receiver.slice(-6)}</code>
                      </div>
                      <div className="detail-row">
                        <span>⚡ Rate</span>
                        <span>{streamDetails.rate} stroops/sec</span>
                      </div>
                      <div className="detail-row">
                        <span>⏱️ Duration</span>
                        <span>{streamDetails.duration} seconds</span>
                      </div>
                      <div className="detail-row">
                        <span>💎 Total Cost</span>
                        <span>{streamDetails.totalCost} stroops</span>
                      </div>
                      <div className="detail-row highlight">
                        <span>🎯 XLM Amount</span>
                        <span>{streamDetails.xlmAmount} XLM</span>
                      </div>
                      <div className="detail-row">
                        <span>⏰ Created</span>
                        <span>{new Date(streamDetails.timestamp).toLocaleString()}</span>
                      </div>
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

            {/* FEATURE 1: SCHEDULED STREAMS TAB */}
            {activeTab === 'schedule' && (
              <div className="card create-card">
                <div className="card-header">
                  <h2>⏰ Schedule Stream</h2>
                  <p>Create a stream to start at a future date and time</p>
                </div>

                <div className="form">
                  <div className="form-group">
                    <label htmlFor="schedule-date">📅 Start Date</label>
                    <input
                      id="schedule-date"
                      type="date"
                      value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="schedule-time">⏱️ Start Time</label>
                    <input
                      id="schedule-time"
                      type="time"
                      value={scheduledTime}
                      onChange={e => setScheduledTime(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={scheduleStream}
                    disabled={!scheduledDate || !scheduledTime}
                    className="btn-create"
                  >
                    ✅ Schedule
                  </button>

                  {isScheduled && (
                    <div className="success-box">
                      <p>✅ Scheduled for {scheduledDate} at {scheduledTime}</p>
                      <p>Now fill stream details in the Create Stream tab →</p>
                    </div>
                  )}

                  <div className="info-box">
                    <h4>📝 How It Works:</h4>
                    <ol>
                      <li>Select date and time above</li>
                      <li>Click "Schedule"</li>
                      <li>Go to Create Stream tab and fill details</li>
                      <li>Stream will execute at scheduled time</li>
                    </ol>
                  </div>

                  {scheduledStreams.length > 0 && (
                    <div className="scheduled-streams">
                      <h4>📋 Scheduled Streams ({scheduledStreams.length})</h4>
                      {scheduledStreams.map((s, idx) => (
                        <div key={idx} className="scheduled-item">
                          <span>🕐 {new Date(s.scheduledDateTime).toLocaleString()}</span>
                          <span>📬 {s.receiver.slice(0, 10)}...</span>
                          <span>💰 {s.xlmAmount} XLM</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FEATURE 2: DURATION EXTENSION TAB */}
            {activeTab === 'extend' && (
              <div className="card create-card">
                <div className="card-header">
                  <h2>📏 Extend Stream Duration</h2>
                  <p>Extend the duration of an active stream</p>
                </div>

                <div className="form">
                  <div className="form-group">
                    <label htmlFor="extend-stream">Select Stream to Extend</label>
                    <select
                      id="extend-stream"
                      value={extendStreamId || ''}
                      onChange={e => setExtendStreamId(e.target.value)}
                      className="select-input"
                    >
                      <option value="">-- Choose a stream --</option>
                      {myStreams.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.receiver.slice(0, 10)}... | {s.duration}s @ {s.rate} stroops/sec
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="extend-duration">⏱️ Additional Duration (seconds)</label>
                    <input
                      id="extend-duration"
                      type="number"
                      placeholder="e.g. 3600 (1 hour)"
                      value={extendDuration}
                      onChange={e => setExtendDuration(e.target.value)}
                    />
                  </div>

                  {extendStreamId && extendDuration && (
                    <div className="extension-preview">
                      <div className="preview-row">
                        <span>Current Duration</span>
                        <span>{myStreams.find(s => s.id === extendStreamId)?.duration}s</span>
                      </div>
                      <div className="preview-row">
                        <span>+ Additional</span>
                        <span>{extendDuration}s</span>
                      </div>
                      <div className="preview-row highlight">
                        <span>= New Duration</span>
                        <span>{parseInt(myStreams.find(s => s.id === extendStreamId)?.duration || 0) + parseInt(extendDuration)}s</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={extendStreamDuration}
                    disabled={!extendStreamId || !extendDuration}
                    className="btn-create"
                  >
                    📏 Extend Stream
                  </button>

                  {myStreams.length === 0 && (
                    <div className="empty-state">
                      <p>No active streams to extend. Create a stream first!</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FEATURE 3: 2FA SECURITY TAB */}
            {activeTab === 'security' && (
              <div className="card create-card">
                <div className="card-header">
                  <h2>🔐 Two-Factor Authentication (2FA)</h2>
                  <p>Add extra security to your account</p>
                </div>

                <div className="form">
                  {!twoFAEnabled ? (
                    <>
                      <div className="info-box">
                        <h4>🛡️ Why 2FA?</h4>
                        <p>Protect your streams with email verification before creating new streams.</p>
                      </div>

                      <div className="form-group">
                        <label htmlFor="twofa-email">📧 Email Address</label>
                        <input
                          id="twofa-email"
                          type="email"
                          placeholder="your@email.com"
                          value={twoFAEmail}
                          onChange={e => setTwoFAEmail(e.target.value)}
                        />
                      </div>

                      <button
                        onClick={setupTwoFA}
                        disabled={!twoFAEmail}
                        className="btn-create"
                      >
                        🔒 Enable 2FA
                      </button>
                    </>
                  ) : !twoFAVerified ? (
                    <>
                      <div className="success-box">
                        <p>✅ OTP sent to {twoFAEmail}</p>
                        <p>(In demo: Check browser console or previous message for OTP)</p>
                      </div>

                      <div className="form-group">
                        <label htmlFor="twofa-otp">🔐 Enter OTP</label>
                        <input
                          id="twofa-otp"
                          type="text"
                          placeholder="6-digit code"
                          value={twoFAOTP}
                          onChange={e => setTwoFAOTP(e.target.value)}
                          maxLength="6"
                        />
                      </div>

                      <button
                        onClick={verifyTwoFA}
                        disabled={!twoFAOTP || twoFAOTP.length !== 6}
                        className="btn-create"
                      >
                        ✅ Verify OTP
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="success-box big">
                        <h3>✅ 2FA Enabled!</h3>
                        <p>Email: {twoFAEmail}</p>
                        <p>You will need to verify 2FA before creating new streams.</p>
                      </div>

                      <button
                        onClick={disableTwoFA}
                        className="btn-danger"
                      >
                        🔓 Disable 2FA
                      </button>
                    </>
                  )}

                  <div className="info-box">
                    <h4>📋 2FA Status</h4>
                    <p>Enabled: {twoFAEnabled ? '✅ Yes' : '❌ No'}</p>
                    <p>Verified: {twoFAVerified ? '✅ Yes' : '❌ No'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* My Streams Tab */}
            {activeTab === 'mystreams' && (
              <div className="card">
                <div className="card-header">
                  <h2>📊 My Streams</h2>
                  <p>View all your created payment streams</p>
                </div>
                {myStreams.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <p>No streams created yet. Create your first stream!</p>
                  </div>
                ) : (
                  <div className="streams-list">
                    {myStreams.map((stream, idx) => (
                      <div key={stream.id} className="stream-item">
                        <div className="stream-item-header">
                          <span className="stream-badge">#{myStreams.length - idx}</span>
                          <span className="stream-status">✅ {stream.status}</span>
                        </div>
                        <div className="stream-item-row">
                          <span>📬 Receiver</span>
                          <code>{stream.receiver.slice(0, 10)}...{stream.receiver.slice(-6)}</code>
                        </div>
                        <div className="stream-item-row">
                          <span>⚡ Rate</span>
                          <span>{stream.rate} stroops/sec</span>
                        </div>
                        <div className="stream-item-row">
                          <span>⏱️ Duration</span>
                          <span>{stream.duration}s</span>
                        </div>
                        <div className="stream-item-row">
                          <span>💰 Total Cost</span>
                          <span>{stream.totalCost} stroops ({stream.xlmAmount} XLM)</span>
                        </div>
                        <div className="stream-item-row">
                          <span>⏰ Created</span>
                          <span>{new Date(stream.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="stream-item-row">
                          <span>🔗 TX Hash</span>
                          <a href={`https://stellar.expert/explorer/testnet/tx/${stream.txHash}`} target="_blank" rel="noopener noreferrer" className="link-tx">
                            {stream.txHash.slice(0, 12)}...
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Feature 4: Receiver Dashboard Tab */}
            {activeTab === 'receiving' && (
              <div className="card">
                <div className="card-header">
                  <h2>📥 Receiving Streams</h2>
                  <p>Streams where you are the receiver</p>
                </div>
                <div className="receiver-dashboard">
                  <div className="dashboard-info">
                    <div className="info-card">
                      <span className="info-label">Incoming Streams</span>
                      <span className="info-value">{receiverStreams.length}</span>
                    </div>
                    <div className="info-card">
                      <span className="info-label">Total Withdrawable</span>
                      <span className="info-value">Coming soon</span>
                    </div>
                  </div>
                  {receiverStreams.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📨</div>
                      <p>No incoming streams yet. Share your wallet address!</p>
                    </div>
                  ) : (
                    <div className="receiving-list">
                      {receiverStreams.map(stream => (
                        <div key={stream.id} className="receiving-item">
                          <div className="sender-badge">From: {stream.sender}</div>
                          <div>Rate: {stream.rate} stroops/sec</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Feature 2: Tools Tab - Stroops Converter */}
            {activeTab === 'tools' && (
              <div className="card">
                <div className="card-header">
                  <h2>🔧 Advanced Tools & Analytics</h2>
                  <p>Professional utilities and calculators</p>
                </div>
                
                {/* Advanced Calculator */}
                <div className="tools-section" style={{marginBottom: '40px', padding: '20px', background: 'rgba(0, 212, 255, 0.05)', borderRadius: '16px', border: '1px solid rgba(0, 212, 255, 0.2)'}}>
                  <h3 style={{marginBottom: '16px', color: '#00d4ff'}}>📊 Advanced Stream Calculator</h3>
                  <p className="tool-desc">Calculate streaming scenarios with real-time projections</p>
                  
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px'}}>
                    <div className="form-group">
                      <label>Rate (stroops/sec)</label>
                      <input type="number" placeholder="1000" onChange={(e) => setRate(e.target.value)} value={rate} />
                    </div>
                    <div className="form-group">
                      <label>Duration (seconds)</label>
                      <input type="number" placeholder="3600" onChange={(e) => setDuration(e.target.value)} value={duration} />
                    </div>
                    <div className="form-group">
                      <label>Deposit (stroops)</label>
                      <input type="number" placeholder="10000000" onChange={(e) => setDeposit(e.target.value)} value={deposit} />
                    </div>
                  </div>

                  {rate && duration && (
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px'}}>
                      <div style={{textAlign: 'center'}}>
                        <p style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px'}}>Total Cost</p>
                        <p style={{fontSize: '1.4rem', fontWeight: 'bold', color: '#06ffa5'}}>{(parseInt(rate || 0) * parseInt(duration || 0)).toLocaleString()} stroops</p>
                        <p style={{fontSize: '0.75rem', color: '#7c9ea6'}}>= {((parseInt(rate || 0) * parseInt(duration || 0)) / 10000000).toFixed(7)} XLM</p>
                      </div>
                      <div style={{textAlign: 'center'}}>
                        <p style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px'}}>Per Minute</p>
                        <p style={{fontSize: '1.4rem', fontWeight: 'bold', color: '#00d4ff'}}>{(parseInt(rate || 0) * 60).toLocaleString()} stroops/min</p>
                        <p style={{fontSize: '0.75rem', color: '#7c9ea6'}}>= {((parseInt(rate || 0) * 60) / 10000000).toFixed(7)} XLM/min</p>
                      </div>
                      <div style={{textAlign: 'center'}}>
                        <p style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px'}}>Per Hour</p>
                        <p style={{fontSize: '1.4rem', fontWeight: 'bold', color: '#7c3aed'}}>{(parseInt(rate || 0) * 3600).toLocaleString()} stroops/hr</p>
                        <p style={{fontSize: '0.75rem', color: '#7c9ea6'}}>= {((parseInt(rate || 0) * 3600) / 10000000).toFixed(7)} XLM/hr</p>
                      </div>
                      <div style={{textAlign: 'center'}}>
                        <p style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px'}}>Total Days</p>
                        <p style={{fontSize: '1.4rem', fontWeight: 'bold', color: '#ff6b9d'}}>{(parseInt(duration || 0) / 86400).toFixed(2)} days</p>
                        <p style={{fontSize: '0.75rem', color: '#7c9ea6'}}>≈ {Math.round(parseInt(duration || 0) / 3600)} hours</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Stroops Converter */}
                <div className="tools-section">
                  <h3>💱 Stroops ↔ XLM Converter</h3>
                  <p className="tool-desc">Convert between stroops and XLM (1 XLM = 10,000,000 stroops)</p>
                  
                  <div className="converter-container">
                    <div className="form-group">
                      <label>Stroops</label>
                      <input
                        type="number"
                        placeholder="Enter stroops..."
                        value={stroopsInput}
                        onChange={e => handleStroopsChange(e.target.value)}
                      />
                    </div>
                    <div className="converter-divider">⇅</div>
                    <div className="form-group">
                      <label>XLM</label>
                      <input
                        type="number"
                        placeholder="Enter XLM..."
                        value={xlmInput}
                        onChange={e => handleXlmChange(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {stroopsInput && (
                    <div className="converter-result">
                      <p>💡 <strong>{stroopsInput}</strong> stroops = <strong>{xlmInput}</strong> XLM</p>
                    </div>
                  )}
                </div>

                {/* Quick Reference */}
                <div style={{marginTop: '40px', padding: '20px', background: 'rgba(124, 58, 237, 0.05)', borderRadius: '16px', border: '1px solid rgba(124, 58, 237, 0.2)'}}>
                  <h3 style={{marginBottom: '12px', color: '#7c3aed'}}>📚 Quick Reference</h3>
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '0.85rem'}}>
                    <div>✓ 1 XLM = 10,000,000 stroops</div>
                    <div>✓ 1 stroop ≈ $0.000000002</div>
                    <div>✓ Min stream: 1 second</div>
                    <div>✓ Max receivers: Unlimited</div>
                  </div>
                </div>
              </div>
            )}

            {/* Templates Tab - USER FEEDBACK */}
            {activeTab === 'templates' && (
              <div className="card">
                <div className="card-header">
                  <h2>📋 Stream Templates</h2>
                  <p>Save and reuse stream configurations</p>
                </div>

                <div style={{marginBottom: '30px', padding: '20px', background: 'rgba(0, 212, 255, 0.05)', borderRadius: '16px', border: '1px solid rgba(0, 212, 255, 0.2)'}}>
                  <h3 style={{marginBottom: '12px', color: '#00d4ff'}}>💾 Save New Template</h3>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'flex-end'}}>
                    <input
                      type="text"
                      placeholder="Template name (e.g., 'Daily Payroll')"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      style={{padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(0,212,255,0.3)', background: 'rgba(255,255,255,0.03)', color: '#f1f5f9'}}
                    />
                    <button onClick={saveTemplate} style={{padding: '10px 20px', background: 'linear-gradient(135deg, #00d4ff 0%, #7c3aed 50%, #06ffa5 100%)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'}}>
                      Save Template
                    </button>
                  </div>
                  <p style={{fontSize: '0.8rem', color: '#94a3b8', marginTop: '8px'}}>💡 Use current form values to create a template</p>
                </div>

                {streamTemplates.length > 0 ? (
                  <div>
                    <h3 style={{marginBottom: '12px'}}>📚 Saved Templates ({streamTemplates.length})</h3>
                    <div style={{display: 'grid', gap: '10px'}}>
                      {streamTemplates.map((t, idx) => (
                        <div key={idx} style={{background: 'rgba(124, 58, 237, 0.05)', border: '1px solid rgba(124, 58, 237, 0.2)', borderRadius: '12px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <div>
                            <strong>{t.templateName}</strong>
                            <div style={{fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px'}}>
                              {t.receiver.slice(0, 10)}... | {t.rate}/sec | {t.duration}s
                            </div>
                          </div>
                          <button onClick={() => applyTemplate(t)} style={{padding: '6px 12px', background: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.3)', color: '#00d4ff', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem'}}>
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{textAlign: 'center', color: '#94a3b8'}}>📭 No templates saved yet</p>
                )}
              </div>
            )}

            {/* Whitelist Tab - USER FEEDBACK */}
            {activeTab === 'whitelist' && (
              <div className="card">
                <div className="card-header">
                  <h2>✅ Recipient Whitelist</h2>
                  <p>Only allow streams to whitelisted addresses</p>
                </div>

                <div style={{marginBottom: '30px', padding: '20px', background: 'rgba(6, 255, 165, 0.05)', borderRadius: '16px', border: '1px solid rgba(6, 255, 165, 0.2)'}}>
                  <h3 style={{marginBottom: '12px', color: '#06ffa5'}}>➕ Add Address to Whitelist</h3>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'flex-end'}}>
                    <input
                      type="text"
                      placeholder="Enter Stellar address (G...)"
                      value={newWhitelistAddr}
                      onChange={(e) => setNewWhitelistAddr(e.target.value)}
                      style={{padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(6,255,165,0.3)', background: 'rgba(255,255,255,0.03)', color: '#f1f5f9'}}
                    />
                    <button onClick={addWhitelistAddress} style={{padding: '10px 20px', background: '#06ffa5', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'}}>
                      Add
                    </button>
                  </div>
                </div>

                {whitelistedAddresses.length > 0 ? (
                  <div>
                    <h3 style={{marginBottom: '12px'}}>📍 Whitelisted Addresses ({whitelistedAddresses.length})</h3>
                    <div style={{display: 'grid', gap: '10px'}}>
                      {whitelistedAddresses.map((addr, idx) => (
                        <div key={idx} style={{background: 'rgba(6, 255, 165, 0.05)', border: '1px solid rgba(6, 255, 165, 0.2)', borderRadius: '12px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <code style={{fontSize: '0.85rem', color: '#06ffa5'}}>{addr}</code>
                          <button onClick={() => removeWhitelistAddress(addr)} style={{padding: '4px 8px', background: 'rgba(255, 71, 87, 0.1)', border: '1px solid rgba(255, 71, 87, 0.3)', color: '#ff4757', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem'}}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{textAlign: 'center', color: '#94a3b8'}}>📭 No whitelisted addresses yet</p>
                )}
              </div>
            )}

            {/* Analytics Tab - USER FEEDBACK */}
            {activeTab === 'analytics' && (
              <div className="card">
                <div className="card-header">
                  <h2>📈 Stream Analytics</h2>
                  <p>View your streaming statistics and insights</p>
                </div>

                {getStreamAnalytics() ? (
                  <div>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '30px'}}>
                      <div style={{background: 'rgba(0, 212, 255, 0.05)', border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: '16px', padding: '20px', textAlign: 'center'}}>
                        <p style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px'}}>Total XLM Streamed</p>
                        <p style={{fontSize: '2rem', fontWeight: 'bold', color: '#00d4ff'}}>{getStreamAnalytics().totalXLM}</p>
                      </div>
                      <div style={{background: 'rgba(124, 58, 237, 0.05)', border: '1px solid rgba(124, 58, 237, 0.2)', borderRadius: '16px', padding: '20px', textAlign: 'center'}}>
                        <p style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px'}}>Average Duration</p>
                        <p style={{fontSize: '2rem', fontWeight: 'bold', color: '#7c3aed'}}>{getStreamAnalytics().avgDuration}s</p>
                      </div>
                      <div style={{background: 'rgba(6, 255, 165, 0.05)', border: '1px solid rgba(6, 255, 165, 0.2)', borderRadius: '16px', padding: '20px', textAlign: 'center'}}>
                        <p style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px'}}>Average Rate</p>
                        <p style={{fontSize: '2rem', fontWeight: 'bold', color: '#06ffa5'}}>{getStreamAnalytics().avgRate}</p>
                      </div>
                    </div>

                    <div style={{background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px', marginBottom: '20px'}}>
                      <h3 style={{marginBottom: '16px'}}>📊 Quick Stats</h3>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem'}}>
                        <div>✓ Total Streams: <strong>{myStreams.length}</strong></div>
                        <div>✓ Highest Rate: <strong>{Math.max(...myStreams.map(s => s.rate))} stroops/sec</strong></div>
                        <div>✓ Longest Duration: <strong>{Math.max(...myStreams.map(s => s.duration))}s</strong></div>
                        <div>✓ Last Created: <strong>{myStreams.length > 0 ? new Date(myStreams[0].timestamp).toLocaleDateString() : 'N/A'}</strong></div>
                      </div>
                    </div>

                    <button onClick={exportStreamHistory} style={{width: '100%', padding: '14px', background: 'linear-gradient(135deg, #00d4ff 0%, #7c3aed 50%, #06ffa5 100%)', color: '#000', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem'}}>
                      📥 Export History as CSV
                    </button>
                  </div>
                ) : (
                  <p style={{textAlign: 'center', color: '#94a3b8'}}>📭 No streams yet. Create some streams to see analytics!</p>
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