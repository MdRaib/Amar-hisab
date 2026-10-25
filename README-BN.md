# আমার হিসাব — Personal Finance Tracker PWA

বাংলা ব্যক্তিগত হিসাবের ওয়েব অ্যাপ: বেতন, দৈনন্দিন খরচ, মাসিক ও দৈনিক বাজেট, সঞ্চয়, ইনসেনটিভ, ধার/ফেরত এবং Google Drive JSON ব্যাকআপ।

## GitHub Pages-এ প্রকাশ

1. ZIP extract করুন।
2. সব ফাইল ও `icons` ফোল্ডার GitHub repository-র root-এ আপলোড করুন।
3. Repository → **Settings → Pages** খুলুন।
4. **Deploy from a branch** নির্বাচন করে `main` branch এবং `/(root)` নির্বাচন করুন।
5. Save করুন এবং GitHub Pages URL তৈরি হওয়া পর্যন্ত অপেক্ষা করুন।
6. URL ফোনের Chrome-এ খুলে browser menu → **Install app** অথবা **Add to Home screen** নির্বাচন করুন।

## Google Drive Backup সেটআপ

এই অ্যাপে OAuth Client ID আগে থেকে বসানো আছে। Google Drive backup চালু করতে Google Cloud Console-এ:

1. Google Drive API enable করুন।
2. OAuth consent screen configure করুন এবং প্রয়োজনীয় test user যোগ করুন (অ্যাপ Testing mode-এ থাকলে)।
3. OAuth 2.0 Client ID-র ধরন **Web application** কিনা যাচাই করুন।
4. **Authorized JavaScript origins**-এ আপনার প্রকৃত GitHub Pages origin যোগ করুন, যেমন `https://YOUR-USERNAME.github.io` (আপনার নিজের URL দিয়ে বদলাবেন)। Path যোগ করবেন না।
5. OAuth consent screen-এ `https://www.googleapis.com/auth/drive.appdata` scope অনুমোদন করুন; Drive App Data folder-এ JSON backup তৈরি হবে।
6. অ্যাপ খুলে **সেটিংস ও ব্যাকআপ → Google Drive সংযুক্ত করুন** চাপুন, Google অনুমতি দিন, তারপর Backup বা Restore বেছে নিন।

Client Secret কখনো frontend-এ রাখবেন না। এই অ্যাপের জন্য Client Secret প্রয়োজন হওয়ার কথা নয়; browser OAuth token flow ব্যবহৃত হয়। Google OAuth client-এর authorized origin ও consent configuration না থাকলে Google Drive backup কাজ করবে না।

## ডেটা ও ব্যাকআপ

- লেনদেন ব্রাউজারের `localStorage`-এ থাকে।
- নিয়মিত **JSON ব্যাকআপ ডাউনলোড** করুন।
- অন্য ফোনে অ্যাপ খুলে Google Drive সংযুক্ত করে **Restore** করুন।
- Restore করলে বর্তমান স্থানীয় ডেটা প্রতিস্থাপিত হবে; আগে ব্যাকআপ নিন।
- Google Drive ব্যাকআপটি Google Drive-এর `appDataFolder`-এ রাখা হয়, সাধারণ ফাইল তালিকায় দেখা নাও যেতে পারে।

## গুরুত্বপূর্ণ নোট

- এটি একটি client-side PWA; কোনো সার্ভার বা ব্যাংক সংযোগ নেই।
- বাজেট অতিক্রম হলেও প্রকৃত লেনদেন রেকর্ড করা যায়, তবে সতর্কবার্তা দেখানো হয়।
- দৈনিক বাজেট অটো মোডে অবশিষ্ট মাসিক বাজেট ও বাকি দিন দিয়ে হিসাব হয়।
- এই প্রাথমিক সংস্করণে ধার ফেরতের রেকর্ড ধার-দায় কমায়; নগদ হাতে থাকা/ব্যাংক ব্যালান্সের পূর্ণ ledger নয়।
- অ্যাপের সব ডেটা সম্পূর্ণ ব্যক্তিগত রাখতে নিজের ডিভাইস লক ও Google অ্যাকাউন্ট সুরক্ষিত রাখুন।


## প্রিমিয়াম ডিজাইন ও ধার ফেরতের ইতিহাস
- মোবাইল-ফার্স্ট, পরিচ্ছন্ন কার্ডভিত্তিক UI, স্পষ্ট নেভিগেশন এবং বড় টাচ-ফ্রেন্ডলি কন্ট্রোল।
- ধার নেওয়া, মোট ফেরত, বাকি ধার—তিনটি সারাংশ আলাদা দেখা যায়।
- প্রতিটি ধার ফেরতের তারিখ ও পরিমাণ আলাদা ইতিহাস হিসেবে সংরক্ষিত হয়; ভুল হলে ফেরতের রেকর্ড এডিট বা মুছতে পারবেন।
- পুরোনো JSON ব্যাকআপে repayment array না থাকলেও Restore-এর সময় খালি তালিকা দিয়ে নিরাপদে শুরু করবে।


## অফলাইন ও Google Drive Auto Backup (আপডেট)
- প্রতিটি পরিবর্তন প্রথমে ফোন/ব্রাউজারের localStorage-এ সেভ হয়; ইন্টারনেট থাকা জরুরি নয়।
- Google Drive প্রথমবার সংযুক্ত করার পর সংযোগের পছন্দ localStorage-এ থাকে। অ্যাপ চালু হলে Google Identity Services-এর `prompt: "none"` দিয়ে নীরবে টোকেন নেওয়ার চেষ্টা করে—আগের দোকানের অ্যাপের মতো।
- হিসাব পরিবর্তনের পর, ইন্টারনেট ফিরে এলে, অ্যাপ আবার সামনে এলে ব্যাকআপের চেষ্টা হয়। ব্যর্থ হলে dirty flag থাকে এবং পরবর্তী সুযোগে আবার চেষ্টা হয়।
- Google-এর browser session/consent না থাকলে Google পুনরায় অনুমতি চাইতে পারে; frontend-only OAuth-এ এটা শতভাগ এড়ানো যায় না।
- ফোনের browser storage মুছে ফেললে লোকাল হিসাব ও সংযোগের পছন্দ হারাতে পারে; নিয়মিত Drive backup/JSON export রাখুন।
- Google Drive API ও OAuth Client ID-তে GitHub Pages-এর সঠিক origin অনুমোদিত থাকতে হবে।


## নতুন: খরচের ইতিহাস মুছে ফেলা
সেটিংস ও ব্যাকআপ অংশে “পুরোনো খরচের ইতিহাস মুছুন” থেকে পুরো মাস/একাধিক মাস অথবা নির্দিষ্ট তারিখের সীমা বেছে নিতে পারবেন। শুধু `type: expense` লেনদেন মুছবে; আয়, সঞ্চয়, ধার, ধার ফেরত ও বাজেট অপরিবর্তিত থাকবে। Google Drive সংযুক্ত থাকলে মুছে ফেলার পর সম্পূর্ণ JSON ব্যাকআপ আপডেট হবে। অফলাইনে থাকলে পরিবর্তন লোকালি সেভ থাকবে এবং পরে Sync করার চেষ্টা করবে।

Google Drive ব্যাকআপ এখন `drive.file` অনুমতি ব্যবহার করে Drive-এ “আমার হিসাব” নামে দৃশ্যমান ফোল্ডারে `amar-hishab-backup.json` রাখে। Google OAuth consent screen/Client ID-তে প্রকাশিত GitHub Pages origin অনুমোদিত থাকতে হবে।
