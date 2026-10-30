window.CFG = {
  APP_NAME: "مليونير كرة القدم",

  // رابط ملف الأسئلة الأونلاين (يتحدّث من GitHub بدون ما تعدّل التطبيق).
  // بعد ما ترفع المشروع على GitHub بدّل USERNAME و REPO باسم حسابك واسم المستودع.
  // طول ما فيه USERNAME هيشتغل التطبيق بالأسئلة المدمجة فقط.
  QUESTIONS_URL: "https://raw.githubusercontent.com/USERNAME/REPO/main/www/questions.json",

  // الذكاء الاصطناعي: بيولّد أسئلة جديدة طول ما النت شغال (متوافق مع واجهة OpenAI chat/completions).
  // الافتراضي: Pollinations (مجاني بدون مفتاح). لو عايز مزوّد تاني حط ENDPOINT و MODEL و API_KEY.
  // تنبيه: أي مفتاح هتحطه هنا بيبقى ظاهر جوه التطبيق — استخدم مفتاح بحد صرف صغير.
  AI: {
    ENABLED: true,
    ENDPOINT: "https://text.pollinations.ai/openai",
    MODEL: "openai",
    API_KEY: ""
  },

  // ماتش 1 ضد 1 ضد لاعب حقيقي: محتاج Firebase Realtime Database.
  // حط رابط القاعدة هنا (مثال: "https://اسم-مشروعك-default-rtdb.firebaseio.com"). لو سبته فاضي هيشتغل الماتش ضد الكمبيوتر بس.
  MATCH: { DB_URL: "" },

  // رابط تحميل اللعبة (اختياري) — بيتضاف تلقائياً لرسالة الواتساب لما تدعو صديق. مثال: رابط الـ Release على GitHub.
  SHARE_URL: "",

  // إعدادات Firebase (اختياري) لتسجيل الدخول بالإيميل الحقيقي + لوحة الأبطال + حفظ التقدم على السحابة.
  // لو سبتها null: تسجيل الدخول بيتحفظ على الجهاز فقط.
  // مثال:
  // FIREBASE: { apiKey:"...", authDomain:"xxx.firebaseapp.com", projectId:"xxx", appId:"..." }
  FIREBASE: null
};
