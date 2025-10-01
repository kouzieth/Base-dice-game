// Base Dice Game - Main Application
class DiceGame {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.account = null;
        this.selectedNumber = 1;
        this.gameHistory = [];
        this.config = window.APP_CONFIG;
        
        // Check if ethers is loaded
        if (typeof ethers === 'undefined') {
            this.showError('Ethers.js library not loaded. Please refresh the page.');
            return;
        }
        
        this.init();
    }

    async init() {
        this.displayConfigStatus();
        this.bindEvents();
        await this.checkConnectedWallet();
        this.updateGameSettings();
    }

    displayConfigStatus() {
        const statusElement = document.getElementById('configStatus');
        const contractElement = document.getElementById('contractAddressShort');
        
        if (!this.config.CONTRACT_ADDRESS || this.config.CONTRACT_ADDRESS.includes("PASTE_YOUR")) {
            statusElement.innerHTML = "❌ <strong>Contract not configured</strong><br>Edit CONTRACT_ADDRESS in config.js";
            statusElement.style.color = "#ff6b6b";
            contractElement.textContent = "Not Configured";
        } else {
            statusElement.innerHTML = "✅ <strong>Contract Configured</strong>";
            statusElement.style.color = "#51cf66";
            contractElement.textContent = `${this.config.CONTRACT_ADDRESS.substring(0, 6)}...${this.config.CONTRACT_ADDRESS.substring(38)}`;
        }
    }

    updateGameSettings() {
        document.getElementById('minBetDisplay').textContent = this.config.MIN_BET;
        document.getElementById('maxBetDisplay').textContent = this.config.MAX_BET;
        document.getElementById('houseEdgeDisplay').textContent = this.config.HOUSE_EDGE;
        
        document.getElementById('betAmount').min = this.config.MIN_BET;
        document.getElementById('betAmount').max = this.config.MAX_BET;
        document.getElementById('betAmount').value = this.config.MIN_BET;
    }

    bindEvents() {
        document.getElementById('connectWallet').addEventListener('click', () => {
            this.connectWallet();
        });

        document.querySelectorAll('.number-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectNumber(parseInt(e.target.dataset.number));
            });
        });

        document.getElementById('rollDice').addEventListener('click', () => {
            this.rollDice();
        });
    }

    async checkConnectedWallet() {
        if (window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    await this.setupWallet(accounts[0]);
                }
            } catch (error) {
                console.error('Error checking wallet:', error);
            }
        }
    }

    async connectWallet() {
        if (!window.ethereum) {
            this.showError('Please install BitGet Wallet mobile app!');
            window.open('https://web3.bitget.com/en/wallet-download', '_blank');
            return;
        }

        try {
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            await this.setupWallet(accounts[0]);
        } catch (error) {
            this.showError('Error connecting wallet: ' + error.message);
        }
    }

    async setupWallet(account) {
        try {
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            this.account = account;
            
            const network = await this.provider.getNetwork();
            await this.checkNetwork(network);
            
            if (this.config.CONTRACT_ADDRESS && !this.config.CONTRACT_ADDRESS.includes("PASTE_YOUR")) {
                this.contract = new ethers.Contract(
                    this.config.CONTRACT_ADDRESS, 
                    this.CONTRACT_ABI, 
                    this.signer
                );
            }
            
            this.updateUI();
            await this.updateBalance();

            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) this.resetUI();
                else this.setupWallet(accounts[0]);
            });

            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });

        } catch (error) {
            this.showError('Error setting up wallet: ' + error.message);
        }
    }

    async checkNetwork(network) {
        const networkElement = document.getElementById('networkInfo');
        const baseSepoliaChainId = '0x14a34';
        
        if (network.chainId === 84532 || network.chainId === parseInt(baseSepoliaChainId, 16)) {
            networkElement.textContent = 'Base Sepolia ✅';
            networkElement.style.color = '#51cf66';
        } else {
            networkElement.textContent = 'Wrong Network ❌';
            networkElement.style.color = '#ff6b6b';
            
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: baseSepoliaChainId }],
                });
            } catch (switchError) {
                console.log('Network switch error:', switchError);
            }
        }
    }

    async updateBalance() {
        if (!this.provider || !this.account) return;
        
        try {
            const balance = await this.provider.getBalance(this.account);
            document.getElementById('balance').textContent = 
                parseFloat(ethers.utils.formatEther(balance)).toFixed(4);
        } catch (error) {
            console.error('Error updating balance:', error);
        }
    }

    selectNumber(number) {
        this.selectedNumber = number;
        document.querySelectorAll('.number-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        event.target.classList.add('selected');
    }

    async rollDice() {
        if (!this.config.CONTRACT_ADDRESS || this.config.CONTRACT_ADDRESS.includes("PASTE_YOUR")) {
            this.showError('❌ Contract not configured. Edit CONTRACT_ADDRESS in config.js');
            return;
        }

        if (!this.contract || !this.account) {
            this.showError('Please connect your wallet first!');
            return;
        }

        const betAmount = document.getElementById('betAmount').value;
        const minBet = parseFloat(this.config.MIN_BET);
        const maxBet = parseFloat(this.config.MAX_BET);
        
        if (!betAmount || betAmount < minBet || betAmount > maxBet) {
            this.showError(`Please enter valid bet amount (${minBet} - ${maxBet} ETH)`);
            return;
        }

        const rollButton = document.getElementById('rollDice');
        const originalText = rollButton.textContent;
        
        try {
            rollButton.disabled = true;
            rollButton.textContent = '🔄 Rolling...';
            
            const tx = await this.contract.rollDice(this.selectedNumber, {
                value: ethers.utils.parseEther(betAmount.toString())
            });
            
            rollButton.textContent = '⏳ Confirming...';
            await tx.wait();
            
            this.addToHistory({
                chosenNumber: this.selectedNumber,
                betAmount: betAmount,
                status: 'completed',
                timestamp: new Date().toLocaleTimeString()
            });
            
            this.showSuccess('🎉 Dice rolled successfully! Check your balance.');
            await this.updateBalance();
            
        } catch (error) {
            console.error('Error rolling dice:', error);
            this.addToHistory({
                chosenNumber: this.selectedNumber,
                betAmount: betAmount,
                status: 'failed'
            });
            
            if (error.code === 4001) {
                this.showError('Transaction cancelled');
            } else {
                this.showError('Error: ' + (error.reason || error.message));
            }
        } finally {
            rollButton.disabled = false;
            rollButton.textContent = originalText;
        }
    }

    addToHistory(game) {
        this.gameHistory.unshift(game);
        if (this.gameHistory.length > 10) {
            this.gameHistory = this.gameHistory.slice(0, 10);
        }
        this.updateHistoryUI();
    }

    updateHistoryUI() {
        const historyContainer = document.getElementById('gameHistory');
        
        if (this.gameHistory.length === 0) {
            historyContainer.innerHTML = '<div class="history-item">No games yet</div>';
            return;
        }
        
        historyContainer.innerHTML = this.gameHistory.map(game => `
            <div class="history-item ${game.status === 'completed' ? 'won' : 'lost'}">
                <div>Number: ${game.chosenNumber} | Bet: ${game.betAmount} ETH</div>
                <small>${game.status === 'completed' ? '✅ Completed' : '❌ Failed'} • ${game.timestamp || ''}</small>
            </div>
        `).join('');
    }

    updateUI() {
        document.getElementById('accountInfo').style.display = 'block';
        document.getElementById('accountAddress').textContent = 
            `${this.account.substring(0, 6)}...${this.account.substring(38)}`;
        document.getElementById('gameSection').style.display = 'block';
        document.getElementById('connectWallet').style.display = 'none';
        document.querySelector('.number-btn[data-number="1"]').classList.add('selected');
    }

    resetUI() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.account = null;
        document.getElementById('accountInfo').style.display = 'none';
        document.getElementById('gameSection').style.display = 'none';
        document.getElementById('connectWallet').style.display = 'block';
        document.getElementById('networkInfo').textContent = 'Disconnected';
        document.getElementById('networkInfo').style.color = '';
    }

    showError(message) {
        alert('❌ ' + message);
    }

    showSuccess(message) {
        alert('✅ ' + message);
    }

    get CONTRACT_ABI() {
        return [
            {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
            {"anonymous":false,"inputs":[
                {"indexed":true,"internalType":"address","name":"player","type":"address"},
                {"indexed":false,"internalType":"uint256","name":"betAmount","type":"uint256"},
                {"indexed":false,"internalType":"uint8","name":"chosenNumber","type":"uint8"},
                {"indexed":false,"internalType":"uint8","name":"diceResult","type":"uint8"},
                {"indexed":false,"internalType":"bool","name":"won","type":"bool"},
                {"indexed":false,"internalType":"uint256","name":"payout","type":"uint256"}
            ],"name":"GameResult","type":"event"},
            {"inputs":[],"name":"getGameCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
            {"inputs":[{"internalType":"uint256","name":"index","type":"uint256"}],"name":"games","outputs":[
                {"internalType":"address","name":"player","type":"address"},
                {"internalType":"uint256","name":"betAmount","type":"uint256"},
                {"internalType":"uint8","name":"chosenNumber","type":"uint8"},
                {"internalType":"uint8","name":"diceResult","type":"uint8"},
                {"internalType":"bool","name":"won","type":"bool"}
            ],"stateMutability":"view","type":"function"},
            {"inputs":[],"name":"houseEdge","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
            {"inputs":[],"name":"maxBet","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
            {"inputs":[],"name":"minBet","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
            {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
            {"inputs":[{"internalType":"uint8","name":"_chosenNumber","type":"uint8"}],"name":"rollDice","outputs":[],"stateMutability":"payable","type":"function"}
        ];
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new DiceGame();
});
