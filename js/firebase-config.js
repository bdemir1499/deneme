// OLTALAMA (PHISHING) KORUMASI: Site kopyalanırsa çalışmayı durdur
const allowedDomains = ["bdemir1499.github.io", "localhost", "127.0.0.1", ""];
if (!allowedDomains.includes(window.location.hostname)) {
    document.documentElement.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#ff4c4c; color:white; font-family:sans-serif; text-align:center; padding: 20px;">
            <h1 style="font-size: 50px;">🛑 DİKKAT! SAHTE SİTE 🛑</h1>
            <h2>Bu web sitesi, orijinal yapımcısından izinsiz kopyalanmış SAHTE ve TEHLİKELİ bir oltalama sitesidir.</h2>
            <p style="font-size: 20px;">Lütfen hiçbir şifrenizi girmeyin, aksi takdirde tüm bilgileriniz çalınabilir.</p>
            <a href="https://bdemir1499.github.io" style="color: yellow; font-size: 24px; margin-top: 20px; font-weight: bold; text-decoration: underline;">ORİJİNAL VE GÜVENLİ SİTEYE GİTMEK İÇİN BURAYA TIKLAYIN</a>
        </div>
    `;
    throw new Error("Phishing attempt blocked! Site domain does not match.");
}

// Gerçek Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyBOK2yl7gUhwntR6SznK8F3obWGP9uScMU",
    authDomain: "deneme-takip-9959c.firebaseapp.com",
    projectId: "deneme-takip-9959c",
    storageBucket: "deneme-takip-9959c.firebasestorage.app",
    messagingSenderId: "407490937441",
    appId: "1:407490937441:web:a1e8c9740dcdcec251a020"
};

// Firebase'i Başlat
firebase.initializeApp(firebaseConfig);

// Servislere kolay erişim için global değişkenler
window.auth = firebase.auth();
window.db = firebase.firestore();

// Uygulamanın alan adı (Sadece kullanıcı adıyla giriş yapabilmek için arka planda eklenecek sahte e-posta uzantısı)
window.FAKE_DOMAIN = "@deneme-takip.com";

// Çıkış Yap Fonksiyonu (Tüm sayfalarda geçerli olması için burada)
window.logout = function() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch(error => {
        console.error("Çıkış hatası:", error);
    });
};
