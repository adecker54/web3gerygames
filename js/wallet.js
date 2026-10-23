// ================================================================
// WALLET.JS - Web3 / Ethers.js integráció és tBNB / Token fizetés
// ================================================================

export class WalletManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.walletAddress = null;
        // A te admin/kassza tárcád címe:
        this.adminAddress = "0xddA74737f502dFc2e2e007Ee11448E4794ADcb44";
        this.BSC_TESTNET_CHAIN_ID = "0x61"; // 97
    }

    // Tárca csatlakoztatása (MetaMask / injected provider)
    async connectWallet() {

        // Megpróbáljuk lekérni a nyelvi modulból, ha elérhető a GeryApp-on keresztül, de ha az eredmény ugyanaz mint a kulcs (vagy üres), akkor a magyar fallback lép életbe
        const langManager = window.GeryApp?.modules?.language;
        let errorText1 = langManager ? langManager.t("wallet_not_found") : "";
        if (!errorText1 || errorText1 === "wallet_not_found") {
            errorText1 = "Most web3 tárca nem található";
        }
        
        if (!window.ethereum) {
            throw new Error(errorText1);
        }

        // Ethers v6 használata esetén (feltételezve, hogy window.ethers elérhető CDN-ből, vagy be van importálva)
        // Ha ethers.js-t ESM-ként vagy globális változóként használsz:
        this.provider = new ethers.BrowserProvider(window.ethereum);
        
        // Hálózat ellenőrzés / átkapcsolás BSC Testnetre
        const network = await this.provider.getNetwork();
        if (Number(network.chainId) !== 97) {
            await this.switchToBscTestnet();
        }

        await this.provider.send("eth_requestAccounts", []);
        this.signer = await this.provider.getSigner();
        this.walletAddress = await this.signer.getAddress();

        console.log(`🦊 Tárca csatlakoztatva: ${this.walletAddress}`);
        return this.walletAddress;
    }

    // Átkapcsolás BSC Testnetre, ha nem ott van a felhasználó
    async switchToBscTestnet() {
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: this.BSC_TESTNET_CHAIN_ID }],
            });
        } catch (switchError) {
            // Ha a hálózat nincs hozzáadva a MetaMaskhoz, hozzáadjuk
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: "wallet_addEthereumChain",
                        params: [{
                            chainId: this.BSC_TESTNET_CHAIN_ID,
                            chainName: "Binance Smart Chain Testnet",
                            nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
                            rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
                            blockExplorerUrls: ["https://testnet.bscscan.com/"]
                        }],
                    });
                } catch (addError) {
                    // Nyelvi szöveg lekérése (fallbackkel)
                    const langManager = window.GeryApp?.modules?.language;
                    let errorText2 = langManager ? langManager.t("testnet_not_found") : "";
                    if (!errorText2 || errorText2 === "testnet_not_found") {
                        errorText2 = "Most nem sikerült a BSC Testnet hálózat hozzáadása a tárcához";
                    }
                    throw new Error(errorText2);
                }
            } else {
                // Más hiba esetén dobjuk tovább az eredeti hibát
                throw switchError;
            }
        }
    }

    // Díj befizetése: tBNB küldése a kassza tárcába a megadott összeggel
    async payEntranceFee(customAmountStr) {
        if (!this.signer) {

            // Megpróbáljuk lekérni a nyelvi modulból, ha elérhető a GeryApp-on keresztül, de ha az eredmény ugyanaz mint a kulcs (vagy üres), akkor a magyar fallback lép életbe
            const langManager = window.GeryApp?.modules?.language;
            let errorText4 = langManager ? langManager.t("no_wallet_connected") : "";
            if (!errorText4 || errorText4 === "no_wallet_connected") {
                errorText4 = "Most nincs csatlakoztatott tárca";
            }
        
            if (!window.ethereum) {
                throw new Error(errorText4);
            }
        }
        const amount = parseFloat(customAmountStr);
        if (isNaN(amount) || amount < 0.005) {
            const langManager = window.GeryApp?.modules?.language;
            let errorText5 = langManager ? langManager.t("min_amount_error") : "";
            if (!errorText5 || errorText === "min_amount_error") {
                errorText5 = "Most a minimális összeg 0.005 tBNB!";
            }                
            throw new Error(errorText5);
        }

        const feeAmount = ethers.parseEther(amount.toString()); 

        try {												
            const tx = await this.signer.sendTransaction({
                to: this.adminAddress,
                value: feeAmount
            });
            const receipt = await tx.wait();
            return receipt;
        // Itt történik a fizetési tranzakció (pl. window.ethereum.request...)
        } catch (err) {
        const msg = (err.message || "").toLowerCase();
        const errorCode = err.code;

        // 1. ELESÉS/MEGSZAKÍTÁS KEZELÉSE
        if (errorCode === 4001 || 
           msg.includes('user rejected') ||
           msg.includes('user denied') || 
           msg.includes('cancelled') || 
           msg.includes('canceled')
        )  {
            let cancelText = langManager ? langManager.t("transaction_cancelled") : "";
            if (!cancelText || cancelText === "transaction_cancelled") {
                cancelText = "Most a folyamat megszakadt";
            }
            throw new Error(cancelText);
        }

        // 2. INSUFFICIENT FUNDS ÉS TÖBBI HIBA

        // Ha fedezethiány van, vagy a gas becslés elhasal a hiányzó egyenleg miatt (CALL_EXCEPTION / missing revert data)
        if (
            msg.includes("insufficient funds") || 
            msg.includes("exceeds the balance") || 
            msg.includes("sender doesn\'t have enough funds") ||
            msg.includes("missing revert data") ||
            errorCode === "CALL_EXCEPTION"
        ) {
        // Megpróbáljuk lekérni a nyelvi modulból, ha elérhető a GeryApp-on keresztül, de ha az eredmény ugyanaz mint a kulcs (vagy üres), akkor a magyar fallback lép életbe
        const langManager = window.GeryApp?.modules?.language;
        let errorText6 = langManager ? langManager.t("insufficient_funds_error") : "";
        if (!errorText6 || errorText === "insufficient_funds_error") {
            errorText6 = "Most a csatlakoztatott tárcában nincs elég fedezet";
        }                
        throw new Error(errorText6);
        }
        throw err; // Egyéb hiba esetén viszi tovább az eredetit
        }
    }
}