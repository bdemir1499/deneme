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
