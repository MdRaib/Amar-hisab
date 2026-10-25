# আমার হিসাব — GitHub-only Offline-First PWA

এই সংস্করণে আলাদা Backend/Render নেই। অ্যাপটি আগে ফোনের localStorage-এ হিসাব সংরক্ষণ করে; Google Drive-এ ব্যাকআপের চেষ্টা পরে হয়।

## GitHub Pages-এ আপডেট
1. ZIP Extract করুন।
2. `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `icons/` আপনার বর্তমান Public GitHub Repository-র root-এ আপলোড/Replace করুন।
3. GitHub → Settings → Pages-এ আপনার আগের প্রকাশনার সেটিংস অপরিবর্তিত রাখুন।
4. সাইটে নতুন সংস্করণ এলে ফোনে পেজ রিফ্রেশ করুন। পুরোনো PWA cache থাকলে অ্যাপ বন্ধ করে আবার খুলুন।

## Google Drive একবার সেটআপ
1. Google Cloud Console-এ Google Drive API enable করুন।
2. OAuth consent screen configure করুন; অ্যাপ Testing mode-এ থাকলে নিজের Google account test user হিসেবে যোগ করুন।
3. OAuth Client ID অবশ্যই Web application হতে হবে। Authorized JavaScript origins-এ আপনার GitHub Pages origin দিন, যেমন `https://USERNAME.github.io` (শেষে repository path দেবেন না)।
4. এই ফাইলে থাকা Client ID আপনার Google Cloud-এর Client ID-র সঙ্গে মিলতে হবে।
5. অ্যাপ খুলে Settings & Backup → Google Drive সংযুক্ত করুন চাপুন এবং permission দিন।

## Offline ও Auto Backup
- হিসাব প্রথমে ফোনের browser storage-এ সেভ হয়। ইন্টারনেট ছাড়াও আয়, খরচ, সঞ্চয়, বাজেট ও ধার-ফেরতের পরিবর্তন করা যায়।
- পরিবর্তনের পর backup pending flag রাখা হয়। ইন্টারনেট ফিরে এলে, অ্যাপ খোলা/আবার foreground-এ এলে, Google Drive backup retry হয়।
- ব্যর্থ হলে পরিবর্তন ফোনে থাকে এবং pending হিসেবে চিহ্নিত থাকে; পরেরবার অনলাইনে এলে আবার চেষ্টা হবে।
- সফল ব্যাকআপ Google Drive-এর `appDataFolder`-এ `amar-hishab-backup.json` নামে থাকে; এটি Drive-এর সাধারণ My Drive ফাইল তালিকায় দেখা নাও যেতে পারে।
- Browser OAuth access token কেবল সাময়িকভাবে memory-তে থাকে। পেজ refresh/ফোন restart-এর পর অ্যাপ silent authorization চেষ্টা করবে; Google session/consent অনুমতি না দিলে আপনাকে একবার Google Drive সংযুক্ত করুন চাপতে হতে পারে। শুধু GitHub Pages দিয়ে পুনরায় অনুমতি কখনোই লাগবে না—এ নিশ্চয়তা দেওয়া যায় না।
- ব্রাউজারের site data মুছে ফেললে local হিসাব মুছে যেতে পারে। নিয়মিত JSON backup download করে রাখুন।

## সীমাবদ্ধতা
GitHub Pages static hosting; এতে server-side refresh token নিরাপদে রাখা যায় না। তাই এই সংস্করণে সম্পূর্ণ background backup guarantee নেই—অ্যাপ খোলা/চালু হলে online retry হয়। Google Drive permission revoke করলে পুনরায় অনুমতি দিতে হবে।
