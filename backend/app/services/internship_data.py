"""Data and scenarios for Japanese Business Internship Roleplay (Nhập vai thực tập sinh Nhật Bản)."""

INDUSTRIES = {
    "it": {
        "id": "it",
        "name": "IT / Lập trình",
        "name_ja": "IT・ソフトウェア開発",
        "icon": "Laptop",
        "company_name": "株式会社ネクステック (NexTech Tokyo)",
        "company_desc": "Công ty phát triển phần mềm và giải pháp chuyển đổi số tại Tokyo.",
        "location": "Tokyo, Shinjuku",
        "interviewer": {
            "name": "高橋 健一 (Takahashi Kenichi)",
            "title": "Giám đốc Kỹ thuật (CTO)",
            "avatar_type": "mentor_male",
            "personality": "Điềm đạm, chuyên nghiệp, chú trọng tư duy logic và tinh thần Ho-Ren-So."
        },
        "interview_questions": [
            {
                "turn": 1,
                "question_ja": "本日は面接にお越しいただき、ありがとうございます。まず簡単に自己紹介をお願いできますでしょうか。",
                "question_vi": "Cảm ơn bạn đã đến tham gia phỏng vấn hôm nay. Trước tiên, bạn có thể giới thiệu ngắn gọn về bản thân được không?",
                "focus": "自己紹介 (Jikoshoukai), xưng hô lịch sự (Watakushi), chào hỏi mở đầu.",
                "hints": [
                    "はじめまして。〇〇と申します。(Tôi là...)",
                    "ベトナムから参りました。(Tôi đến từ Việt Nam...)",
                    "本日はどうぞよろしくお願いいたします。(Hôm nay xin nhờ anh/chị giúp đỡ ạ.)"
                ]
            },
            {
                "turn": 2,
                "question_ja": "ありがとうございます。なぜ日本のIT業界、そして弊社で働きたいと思ったのですか？志望動機を教えてください。",
                "question_vi": "Cảm ơn bạn. Vì sao bạn muốn làm việc trong ngành IT Nhật Bản và ứng tuyển vào công ty chúng tôi? Hãy cho tôi biết động lực ứng tuyển.",
                "focus": "志望動機 (Shibou douki), lý do chọn ngành IT và công ty Nhật Bản.",
                "hints": [
                    "日本の高い技術力とチームワークに魅力を感じました。",
                    "将来、日越をつなぐブリッジエンジニアになりたいと考えております。"
                ]
            },
            {
                "turn": 3,
                "question_ja": "開発中に締め切り直前で解決が難しいバグを見つけた場合、あなたならどのように対応しますか？",
                "question_vi": "Nếu trong quá trình phát triển, ngay trước deadline bạn phát hiện một bug khó sửa, bạn sẽ xử lý thế nào?",
                "focus": "Ho-Ren-So (報告・連絡・相談), báo cáo kịp thời cho cấp trên, không giấu lỗi.",
                "hints": [
                    "すぐに先輩やリーダーに現状を報告し、相談いたします。(Báo cáo và thảo luận ngay với cấp trên)",
                    "影響範囲を特定し、対策案を提案します。(Xác định phạm vi ảnh hưởng và đề xuất giải pháp)"
                ]
            },
            {
                "turn": 4,
                "question_ja": "最後に、何か弊社について聞いておきたいこと（逆質問）はありますか？",
                "question_vi": "Cuối cùng, bạn có câu hỏi nào muốn hỏi chúng tôi không (câu hỏi ngược)?",
                "focus": "逆質問 (Gyakushitsumon), thể hiện sự chủ động, ham học hỏi và quan tâm đến công ty.",
                "hints": [
                    "入社までに学んでおくべき技術や知識はありますでしょうか。(Trước khi vào cty em nên chuẩn bị kiến thức công nghệ gì ạ?)",
                    "実習生に最も期待される役割は何でしょうか。(Kỳ vọng lớn nhất đối với thực tập sinh là gì ạ?)"
                ]
            }
        ],
        "scenarios": [
            {
                "id": "it_l1",
                "level": 1,
                "level_name": "Cấp 1: Thực tập sinh mới (N5)",
                "title": "Ngày đầu đi làm & Chào hỏi phòng ban",
                "npc_name": "佐藤 先輩 (Sato-senpai)",
                "npc_title": "Kỹ sư phụ trách hướng dẫn",
                "goal": "Chào hỏi lễ phép ngày đầu nhận việc, xin phép hỏi vị trí bàn làm việc và tài khoản nội bộ.",
                "turns": [
                    {
                        "npc_ja": "おはようございます！今日から開発チームに配属ですね。自己紹介をお願いできますか？",
                        "npc_vi": "Chào buổi sáng! Em được phân về team phát triển từ hôm nay đúng không? Giới thiệu bản thân một chút nhé!",
                        "hints": ["おはようございます。今日から実習生としてお世話になります〇〇です。よろしくお願いします！"]
                    },
                    {
                        "npc_ja": "ようこそ！こちらが君のデスクです。PCのセットアップについて何か質問はありますか？",
                        "npc_vi": "Chào mừng em! Đây là bàn làm việc của em. Em có thắc mắc gì về việc cài đặt máy tính không?",
                        "hints": ["Wi-Fiのパスワードと開発用のアカウントを教えていただけますでしょうか。"]
                    }
                ]
            },
            {
                "id": "it_l2",
                "level": 2,
                "level_name": "Cấp 2: Thực tập sinh (N4)",
                "title": "Nhận task & Báo cáo Ho-Ren-So khi gặp lỗi",
                "npc_name": "佐藤 先輩 (Sato-senpai)",
                "npc_title": "Kỹ sư phụ trách hướng dẫn",
                "goal": "Báo cáo tiến độ và chủ động nhờ hướng dẫn khi gặp sự cố không thể tự giải quyết.",
                "turns": [
                    {
                        "npc_ja": "〇〇さん、今朝頼んだログイン機能のテストの進捗はどうですか？",
                        "npc_vi": "〇〇-san, tiến độ test chức năng đăng nhập sáng nay tôi giao thế nào rồi em?",
                        "hints": ["現在80%完了しておりますが、API連携でエラーが出ており、少しご相談させていただけますでしょうか。"]
                    },
                    {
                        "npc_ja": "分かりました。どんなエラーが出ているのか、画面を見せてもらえますか？",
                        "npc_vi": "Tôi hiểu rồi. Lỗi hiển thị như thế nào, em có thể cho tôi xem màn hình được không?",
                        "hints": ["はい、こちらのエラーログです。サーバーからの応答がタイムアウトになっています。"]
                    }
                ]
            },
            {
                "id": "it_l3",
                "level": 3,
                "level_name": "Cấp 3: Nhân viên tập sự (N3)",
                "title": "Họp Scrum buổi sáng (Chourei) & Viết email xin nghỉ",
                "npc_name": "高橋 マネージャー (Takahashi Manager)",
                "npc_title": "Project Manager",
                "goal": "Báo cáo công việc hôm qua, kế hoạch hôm nay trong cuộc họp Scrum ngắn gọn, súc tích.",
                "turns": [
                    {
                        "npc_ja": "では朝会を始めます。〇〇さん、昨日の実績と今日の予定を共有してください。",
                        "npc_vi": "Giờ chúng ta bắt đầu họp sáng nhé. 〇〇-san, xin mời em chia sẻ kết quả hôm qua và kế hoạch hôm nay.",
                        "hints": ["昨日はデータベースの設計を完了しました。本日はAPIの実装を進める予定です。特に問題はありません。"]
                    },
                    {
                        "npc_ja": "順調ですね。今週の金曜日にコードレビューを行いますが、準備は間に合いますか？",
                        "npc_vi": "Tiến độ tốt đấy. Thứ sáu tuần này chúng ta sẽ review code, em chuẩn bị kịp chứ?",
                        "hints": ["はい、木曜日までにドキュメントとコードを整えておきますので、よろしくお願いいたします。"]
                    }
                ]
            },
            {
                "id": "it_l4",
                "level": 4,
                "level_name": "Cấp 4: Nhân viên chính thức (N2)",
                "title": "Tiếp khách hàng đối tác & Tạ lỗi sự cố hệ thống (Shazai)",
                "npc_name": "木村 部長 (Kimura Bucho - Khách hàng)",
                "npc_title": "Khách hàng đại diện đối tác",
                "goal": "Sử dụng kính ngữ Keigo (Sonkeigo & Kenjougo) tiếp đón và giải thích minh bạch khi có sự cố kỹ thuật.",
                "turns": [
                    {
                        "npc_ja": "お世話になっております。昨日システムの稼働が一時停止したと伺ったのですが、原因は何でしょうか？",
                        "npc_vi": "Chào anh. Tôi nghe nói hôm qua hệ thống bị gián đoạn hoạt động tạm thời, nguyên nhân là gì vậy?",
                        "hints": ["大変ご迷惑をおかけいたしまして、心よりお詫び申し上げます。サーバーの負荷増大が原因でございました。"]
                    },
                    {
                        "npc_ja": "今後の再発防止策についてはどのように考えていらっしゃいますか？",
                        "npc_vi": "Vậy phía các anh dự định có biện pháp phòng ngừa tái diễn như thế nào trong tương lai?",
                        "hints": ["現在サーバーの自動スケール機能を導入し、監視体制を強化いたしました。本日中に詳細な報告書を提出いたします。"]
                    }
                ]
            },
            {
                "id": "it_l5",
                "level": 5,
                "level_name": "Cấp 5: Trưởng nhóm (N1)",
                "title": "Thuyết trình đề xuất giải pháp kỹ thuật & Đàm phán tiến độ",
                "npc_name": "役員会 (Hội đồng quản trị)",
                "npc_title": "Ban điều hành công ty",
                "goal": "Dùng tiếng Nhật thương mại cao cấp thuyết phục ban giám đốc về giải pháp kiến trúc mới.",
                "turns": [
                    {
                        "npc_ja": "新規プロジェクトのアーキテクチャ刷新について、チームの提案を聞かせてください。",
                        "npc_vi": "Về việc đổi mới kiến trúc dự án mới, xin hãy cho chúng tôi nghe đề xuất của nhóm bạn.",
                        "hints": ["ご説明の機会をいただき恐縮でございます。マイクロサービス化により、保守コストを30%削減可能と試算しております。"]
                    },
                    {
                        "npc_ja": "移行に伴うリスクと移行期間の短縮についてはどのような見解をお持ちですか？",
                        "npc_vi": "Nhóm có nhận định thế nào về các rủi ro trong quá trình chuyển đổi và khả năng rút ngắn thời gian?",
                        "hints": ["段階的移行プランを採用することで、サービス停止リスクを極小化しつつ、四半期以内の完遂を目指します。"]
                    }
                ]
            }
        ]
    },
    "hospitality": {
        "id": "hospitality",
        "name": "Nhà hàng / Khách sạn",
        "name_ja": "飲食・ホテル・接客",
        "icon": "Utensils",
        "company_name": "ホテル雅・京都 (Hotel Miyabi Kyoto)",
        "company_desc": "Khách sạn phong cách truyền thống kết hợp hiện đại cao cấp tại Kyoto.",
        "location": "Kyoto, Gion",
        "interviewer": {
            "name": "田中 雅人 (Tanaka Masato)",
            "title": "Tổng Quản lý Khách sạn",
            "avatar_type": "mentor_formal",
            "personality": "Nho nhã, lịch thiệp, cực kỳ chú trọng chuẩn mực kính ngữ và thái độ Omotenashi."
        },
        "interview_questions": [
            {
                "turn": 1,
                "question_ja": "ホテル雅の面接へようこそ。まず、お名前とこれまでのご経験を自己紹介していただけますか。",
                "question_vi": "Chào mừng bạn đến buổi phỏng vấn của Hotel Miyabi. Trước tiên, bạn có thể giới thiệu họ tên và kinh nghiệm bản thân được không?",
                "focus": "Lễ phép, ánh mắt, nụ cười thân thiện, xưng hô Watakushi.",
                "hints": ["はじめまして。〇〇と申します。接客業を通じて日本の「おもてなし」の心を学びたいと考えております。"]
            },
            {
                "turn": 2,
                "question_ja": "接客において、お客様をもてなす際に最も大切にしたいことは何ですか？",
                "question_vi": "Trong ngành dịch vụ khách hàng, điều gì bạn coi trọng nhất khi phục vụ khách?",
                "focus": "Tinh thần Omotenashi (おもてなし), lắng nghe, quan sát nhu cầu của khách.",
                "hints": ["お客様の言葉になる前のニーズに気づき、笑顔で誠心誠意対応することです。"]
            },
            {
                "turn": 3,
                "question_ja": "もしお客様から料理やサービスについてお叱り（クレーム）を受けた場合、最初にするべき対応は何でしょうか。",
                "question_vi": "Nếu khách hàng phàn nàn tức giận về món ăn hoặc dịch vụ, điều đầu tiên bạn nên làm là gì?",
                "focus": "Lắng nghe cẩn thận, tạ lỗi chân thành, không cãi lại, báo cáo cấp trên.",
                "hints": ["まず不快な思いをさせたことを心からお詫びし、お客様のお話を遮らずに最後までお伺いします。"]
            },
            {
                "turn": 4,
                "question_ja": "最後に、当ホテルで働く上で何か確認しておきたい質問はございますか？",
                "question_vi": "Cuối cùng, bạn có câu hỏi nào muốn tìm hiểu về khách sạn của chúng tôi không?",
                "focus": "Câu hỏi chuyên nghiệp thể hiện mong muốn gắn bó lâu dài.",
                "hints": ["外国人観光客のお客様のご利用比率や、研修制度について教えていただけますでしょうか。"]
            }
        ],
        "scenarios": [
            {
                "id": "hosp_l1",
                "level": 1,
                "level_name": "Cấp 1: Thực tập sinh mới (N5)",
                "title": "Đón khách & Chào hỏi công sở nhà hàng",
                "npc_name": "山田 先輩 (Yamada-senpai)",
                "npc_title": "Tổ trưởng lễ tân",
                "goal": "Thực hành câu chào đón khách chuẩn mực và hỏi vị trí đồ dùng.",
                "turns": [
                    {
                        "npc_ja": "お客様がいらっしゃいましたよ。大きな声で笑顔で挨拶してみましょう！",
                        "npc_vi": "Có khách đến kìa em. Hãy nở nụ cười và chào thật to rõ ràng nào!",
                        "hints": ["いらっしゃいませ！ホテル雅へようこそお越しくださいました。"]
                    },
                    {
                        "npc_ja": "とても爽やかな挨拶ですね！お客様をお席までご案内できますか？",
                        "npc_vi": "Lời chào rất tươi vui! Em có thể hướng dẫn khách đến bàn được không?",
                        "hints": ["はい、かしこまりました。こちらへどうぞ、ご案内いたします。"]
                    }
                ]
            },
            {
                "id": "hosp_l2",
                "level": 2,
                "level_name": "Cấp 2: Thực tập sinh (N4)",
                "title": "Ghi nhận yêu cầu món ăn & Báo cáo với Bếp trưởng",
                "npc_name": "料理長 (Bếp trưởng Watanabe)",
                "npc_title": "Bếp trưởng nhà hàng",
                "goal": "Báo cáo rõ ràng yêu cầu dị ứng thực phẩm của khách cho bộ phận bếp.",
                "turns": [
                    {
                        "npc_ja": "3番テーブルのお客様から何か特別な注文はあったかい？",
                        "npc_vi": "Bàn số 3 khách có yêu cầu gì đặc biệt không em?",
                        "hints": ["はい、3番テーブルのお客様は甲殻類アレルギーをお持ちとのことですので、エビを除去するようお願いいたします。"]
                    },
                    {
                        "npc_ja": "了解した、教えてくれて助かったよ。復唱して間違いがないか確認してくれ。",
                        "npc_vi": "Hiểu rồi, may mà em báo kịp. Hãy nhắc lại để xác nhận không nhầm lẫn nhé.",
                        "hints": ["かしこまりました。3番テーブル様、甲殻類抜きでご用意いたします。よろしくお願いいたします。"]
                    }
                ]
            }
        ]
    },
    "kaigo": {
        "id": "kaigo",
        "name": "Điều dưỡng (Kaigo)",
        "name_ja": "介護・高齢者福祉",
        "icon": "HeartHandshake",
        "company_name": "社会福祉法人さくらケア (Sakura Kaigo Care)",
        "company_desc": "Trung tâm chăm sóc và viện dưỡng lão nhân văn hiện đại tại Osaka.",
        "location": "Osaka, Sakai",
        "interviewer": {
            "name": "鈴木 美咲 (Suzuki Misaki)",
            "title": "Viện trưởng Trung tâm",
            "avatar_type": "mentor_female",
            "personality": "Tận tâm, dịu dàng, coi trọng sự lễ độ, kiên nhẫn và lòng trắc ẩn."
        },
        "interview_questions": [
            {
                "turn": 1,
                "question_ja": "本日はさくらケアにお越しいただきありがとうございます。自己紹介と、介護の仕事を選んだ理由を教えてください。",
                "question_vi": "Cảm ơn bạn đã đến Sakura Care hôm nay. Hãy giới thiệu bản thân và lý do bạn chọn ngành điều dưỡng chăm sóc.",
                "focus": "Tình cảm chân thành, mong muốn giúp đỡ người cao tuổi, thái độ kiên nhẫn.",
                "hints": ["人と接することが好きで、日本の先進的な介護技術と温かいケアを学びたいと思い志望いたしました。"]
            },
            {
                "turn": 2,
                "question_ja": "高齢者の方とコミュニケーションを取る際、どんなことに気を配りたいと考えていますか？",
                "question_vi": "Khi giao tiếp với người cao tuổi, bạn dự định chú ý đến những điều gì?",
                "focus": "Nói chậm, rõ ràng, nhìn vào mắt, dùng từ ngữ tôn kính và ân cần.",
                "hints": ["目線を合わせてゆっくり聞き取りやすい声で話し、相手のペースに寄り添うことを心がけます。"]
            },
            {
                "turn": 3,
                "question_ja": "利用者の体調に少しでも異変を感じた時、あなたならどう行動しますか？",
                "question_vi": "Khi cảm thấy tình trạng sức khỏe của người dùng có dấu hiệu bất thường dù nhỏ, bạn sẽ hành động thế nào?",
                "focus": "Báo cáo ngay cho y tá (Kangoshi) hoặc quản lý, không tự ý phán đoán.",
                "hints": ["勝手に判断せず、直ちに看護師や責任者にバイタルサインと状態を報告いたします。"]
            },
            {
                "turn": 4,
                "question_ja": "介護の現場は体力も必要ですが、ご自身の健康管理やストレス解消法はありますか？",
                "question_vi": "Môi trường điều dưỡng đòi hỏi thể lực, bạn quản lý sức khỏe và giải tỏa căng thẳng như thế nào?",
                "focus": "Sức khỏe tốt, lối sống lành mạnh, tinh thần lạc quan.",
                "hints": ["休日は運動や趣味でリフレッシュし、十分な睡眠と食事で体調管理を徹底しております。"]
            }
        ],
        "scenarios": [
            {
                "id": "kaigo_l1",
                "level": 1,
                "level_name": "Cấp 1: Thực tập sinh mới (N5)",
                "title": "Chào hỏi buổi sáng ân cần với người cao tuổi",
                "npc_name": "吉田 おじいさん (Cụ Yoshida)",
                "npc_title": "Người cao tuổi tại viện",
                "goal": "Chào hỏi lễ phép, tươi tắn và hỏi thăm sức khỏe buổi sáng.",
                "turns": [
                    {
                        "npc_ja": "おはよう。今日はいい天気だねぇ、あんた新しい実習生さんかい？",
                        "npc_vi": "Chào cháu. Hôm nay trời đẹp nhỉ, cháu là thực tập sinh mới tới à?",
                        "hints": ["おはようございます、吉田様！はい、今日からお世話になります〇〇です。よろしくお願いいたします。"]
                    },
                    {
                        "npc_ja": "おお、元気な挨拶で気持ちがいいね。昨日はよく眠れたかい？",
                        "npc_vi": "Ôi lời chào tràn đầy năng lượng nghe thích quá. Cháu ngủ có ngon không?",
                        "hints": ["はい、ぐっすり眠れました！吉田様は昨晩よくお休みになれましたか？お体の調子はいかがですか？"]
                    }
                ]
            }
        ]
    },
    "engineering": {
        "id": "engineering",
        "name": "Xây dựng / Kỹ thuật",
        "name_ja": "建設・土木・施工管理",
        "icon": "HardHat",
        "company_name": "大和建設株式会社 (Yamato Construction)",
        "company_desc": "Tập đoàn xây dựng công trình hạ tầng và dân dụng hàng đầu tại Aichi.",
        "location": "Nagoya, Aichi",
        "interviewer": {
            "name": "佐藤 剛 (Sato Tsuyoshi)",
            "title": "Giám đốc Công trường",
            "avatar_type": "mentor_hardy",
            "personality": "Mạnh mẽ, cương trực, đặt tiêu chuẩn an toàn lao động và kỷ luật lên hàng đầu."
        },
        "interview_questions": [
            {
                "turn": 1,
                "question_ja": "建設の現場は声の大きさと安全意識が命だ。まず元気よく自己紹介を聞かせてくれ！",
                "question_vi": "Công trường xây dựng thì giọng nói to rõ và ý thức an toàn là số một. Hãy cho tôi nghe phần tự giới thiệu thật to rõ nào!",
                "focus": "Giọng to, tự tin, tư thế đứng thẳng, chào hỏi dứt khoát.",
                "hints": ["はい！ベトナムから参りました〇〇と申します！安全第一で真面目に技術を学びます！よろしくお願いします！"]
            },
            {
                "turn": 2,
                "question_ja": "現場では「5S」や「指差呼称（しさこしょう）」を徹底しているが、安全対策についてどう考えている？",
                "question_vi": "Tại công trường chúng tôi thực hiện triệt để 5S và chỉ tay hô tên (chỉ tay xác nhận an toàn), bạn nghĩ sao về việc phòng ngừa an toàn?",
                "focus": "Tuân thủ quy định an toàn, không làm ẩu, bảo vệ bản thân và đồng nghiệp.",
                "hints": ["安全は何よりも最優先です。指差呼称を徹底し、ルールを守って事故ゼロを目指します。"]
            },
            {
                "turn": 3,
                "question_ja": "雨や猛暑など厳しい環境でも作業があるが、体力やチームでの連携に自信はあるか？",
                "question_vi": "Đôi khi phải làm việc dưới trời mưa hay nắng gắt, bạn có tự tin về thể lực và khả năng phối hợp nhóm không?",
                "focus": "Sức bền, tinh thần đồng đội, sẵn sàng hỗ trợ đồng nghiệp.",
                "hints": ["はい、体力には自信があります！チームの仲間と常に声を掛け合い、助け合って作業いたします！"]
            },
            {
                "turn": 4,
                "question_ja": "よし、最後に何か現場や寮生活について聞いておきたいことはあるか？",
                "question_vi": "Tốt. Cuối cùng bạn có thắc mắc gì về công trường hay sinh hoạt ký túc xá không?",
                "focus": "Câu hỏi thực tế về trang thiết bị bảo hộ, học hỏi chứng chỉ an toàn.",
                "hints": ["現場で使用する安全用具の規格や、取得できる資格について教えていただけますでしょうか。"]
            }
        ],
        "scenarios": [
            {
                "id": "eng_l1",
                "level": 1,
                "level_name": "Cấp 1: Thực tập sinh mới (N5)",
                "title": "Chào cờ buổi sáng (Asaire) & Kiểm tra đồ bảo hộ",
                "npc_name": "佐藤 現場長 (Sato Genbacho)",
                "npc_title": "Chỉ huy trưởng công trường",
                "goal": "Chào hỏi to rõ và xác nhận trang bị bảo hộ đầy đủ.",
                "turns": [
                    {
                        "npc_ja": "ご安全に！ヘルメットのアゴ紐と安全靴の着用は確認したか？",
                        "npc_vi": "Chúc làm việc an toàn! Em đã kiểm tra quai nón bảo hộ và giày bảo hộ chưa?",
                        "hints": ["ご安全に！はい、ヘルメット、安全帯、安全靴ともによし！確認いたしました！"]
                    }
                ]
            }
        ]
    },
    "manufacturing": {
        "id": "manufacturing",
        "name": "Sản xuất / Nhà máy",
        "name_ja": "製造・精密機械・工場",
        "icon": "Factory",
        "company_name": "明星精密工業株式会社 (Meisei Seiko)",
        "company_desc": "Nhà máy gia công cơ khí chính xác và lắp ráp linh kiện phụ tùng ô tô.",
        "location": "Kanagawa, Yokohama",
        "interviewer": {
            "name": "渡辺 誠 (Watanabe Makoto)",
            "title": "Quản đốc Phân xưởng",
            "avatar_type": "mentor_male",
            "personality": "Tỉ mỉ, kỷ luật cao, luôn nhấn mạnh chất lượng không lỗi (Zero Defect)."
        },
        "interview_questions": [
            {
                "turn": 1,
                "question_ja": "面接にお越しいただきありがとう。当社の精密製造ラインを志望した理由を聞かせてほしい。",
                "question_vi": "Cảm ơn bạn đã đến phỏng vấn. Hãy cho tôi biết lý do bạn ứng tuyển vào dây chuyền sản xuất chính xác của công ty.",
                "focus": "Niềm đam mê chế tạo (Monodukuri), tính cẩn thận, tỉ mỉ.",
                "hints": ["日本の精密な「ものづくり」の技術に憧れ、高品質な製品作りに貢献したいと思い志望いたしました。"]
            },
            {
                "turn": 2,
                "question_ja": "製造現場では「整理・整頓・清掃・清潔・躾」の5Sが基本だが、日常生活で実践していることはあるか？",
                "question_vi": "Tại nhà xưởng thì 5S là nền tảng, trong cuộc sống hàng ngày bạn có thói quen gì liên quan không?",
                "focus": "Ý thức ngăn nắp, đúng giờ, giữ gìn nơi làm việc sạch sẽ.",
                "hints": ["使った道具は必ず決まった場所に戻し、身の回りの整理整頓を常に習慣にしております。"]
            },
            {
                "turn": 3,
                "question_ja": "もし機械の異音や不良品を発見した場合、どう行動するべきだと思う？",
                "question_vi": "Nếu phát hiện tiếng kêu lạ của máy móc hoặc phế phẩm lỗi, theo bạn nên làm gì?",
                "focus": "Quy tắc Dừng - Gọi - Chờ (止める・呼ぶ・待つ).",
                "hints": ["直ちにラインを停止し、リーダーを呼んで状況を報告し、指示を待ちます。勝手に動かしません。"]
            },
            {
                "turn": 4,
                "question_ja": "最後に、工場での作業にあたって何か質問はあるかい？",
                "question_vi": "Cuối cùng, về công việc tại nhà máy em có câu hỏi gì không?",
                "focus": "Thể hiện mong muốn học hỏi quy trình sản xuất tiêu chuẩn.",
                "hints": ["作業標準書の確認方法や、品質改善（カイゼン）活動への参加について教えていただけますでしょうか。"]
            }
        ],
        "scenarios": [
            {
                "id": "mfg_l1",
                "level": 1,
                "level_name": "Cấp 1: Thực tập sinh mới (N5)",
                "title": "Bàn giao ca làm việc & Kiểm tra quy tắc 5S",
                "npc_name": "小野 リーダー (Ono Leader)",
                "npc_title": "Tổ trưởng chuyền sản xuất",
                "goal": "Báo cáo số lượng hoàn thành và dọn dẹp vệ sinh máy móc.",
                "turns": [
                    {
                        "npc_ja": "お疲れ様！今日の割り当て分の部品加工は予定通り終わったかい？",
                        "npc_vi": "Vất vả rồi! Số lượng chi tiết gia công phân công hôm nay em đã xong theo kế hoạch chưa?",
                        "hints": ["お疲れ様です！本日目標の100個の加工をすべて完了し、不良品はゼロでした。"]
                    }
                ]
            }
        ]
    },
    "business": {
        "id": "business",
        "name": "Bán lẻ / Kinh doanh",
        "name_ja": "商業・貿易・営業アシスタント",
        "icon": "Briefcase",
        "company_name": "丸の内商事株式会社 (Marunouchi Trading)",
        "company_desc": "Công ty thương mại xuất nhập khẩu hàng tiêu dùng và nông sản Nhật - Việt.",
        "location": "Tokyo, Marunouchi",
        "interviewer": {
            "name": "小林 聡 (Kobayashi Satoshi)",
            "title": "Trưởng phòng Kinh doanh Quốc tế",
            "avatar_type": "mentor_formal",
            "personality": "Nhanh nhạy, lịch lãm, chuyên gia về đàm phán và phong thái ngoại giao thương mại."
        },
        "interview_questions": [
            {
                "turn": 1,
                "question_ja": "丸の内商事の面接へようこそ。まずあなたの強みを交えて自己紹介をお願いします。",
                "question_vi": "Chào mừng bạn đến buổi phỏng vấn của Marunouchi Trading. Hãy giới thiệu bản thân kết hợp nêu bật thế mạnh của bạn.",
                "focus": "Giao tiếp hoạt ngôn, tự tin, am hiểu cả văn hóa Nhật Bản và Việt Nam.",
                "hints": ["私の強みは異文化への適応力と粘り強さです。日越両国の架け橋として営業を支えたいと存じます。"]
            },
            {
                "turn": 2,
                "question_ja": "日本のビジネスマナー、例えば名刺交換や電話応対で知っているルールはありますか？",
                "question_vi": "Về quy tắc ứng xử thương mại Nhật Bản, ví dụ như trao danh thiếp hay nghe điện thoại, bạn biết những quy tắc nào?",
                "focus": "Quy tắc trao danh thiếp 2 tay, không che tên, nghe điện thoại chuông reo không quá 3 tiếng.",
                "hints": ["名刺は両手で持ち、相手の目を見て胸の高さで差し出します。電話は3コール以内に出るのが基本です。"]
            },
            {
                "turn": 3,
                "question_ja": "取引先との約束の時間に電車遅延で遅れそうな場合、どう対応しますか？",
                "question_vi": "Nếu trên đường đến gặp đối tác mà tàu trễ có nguy cơ muộn hẹn, bạn sẽ xử lý thế nào?",
                "focus": "Liên lạc trước ít nhất 15-30 phút, tạ lỗi, giải thích lý do và ước tính giờ đến chính xác.",
                "hints": ["遅れると分かった時点で直ちに先方へ電話し、お詫びした上で到着見込み時刻をお伝えします。"]
            },
            {
                "turn": 4,
                "question_ja": "最後に、弊社でのキャリアプランについて何か質問はありますか？",
                "question_vi": "Cuối cùng, bạn có câu hỏi nào về lộ trình thăng tiến tại công ty không?",
                "focus": "Câu hỏi thể hiện định hướng phát triển rõ ràng.",
                "hints": ["実習終了後、正社員への登用制度や海外拠点での活躍機会についてお聞かせいただけますでしょうか。"]
            }
        ],
        "scenarios": [
            {
                "id": "biz_l1",
                "level": 1,
                "level_name": "Cấp 1: Thực tập sinh mới (N5)",
                "title": "Trao đổi danh thiếp (Meishi Koukan) lần đầu",
                "npc_name": "取引先担当者 (Đối tác Tanaka)",
                "npc_title": "Đại diện công ty đối tác",
                "goal": "Thực hành câu chào và trao đổi danh thiếp đúng phong cách Nhật Bản.",
                "turns": [
                    {
                        "npc_ja": "はじめまして、ABC物産の田中と申します。名刺を頂戴できますか？",
                        "npc_vi": "Xin chào, tôi là Tanaka đến từ ABC Bussan. Tôi xin phép được nhận danh thiếp của bạn được không?",
                        "hints": ["頂戴いたします。丸の内商事の〇〇と申します。どうぞよろしくお願い申し上げます。"]
                    }
                ]
            }
        ]
    }
}

BUSINESS_HANDBOOK = [
    {
        "id": "ojigi",
        "title": "Quy tắc cúi chào (お辞儀 - Ojigi)",
        "icon": "UserCheck",
        "summary": "Cúi chào thể hiện sự tôn trọng, khiêm nhường và chuyên nghiệp trong giao tiếp công sở Nhật Bản.",
        "details": [
            {
                "name": "Eshaku (会釈 - Chào nhẹ 15°)",
                "usage": "Dùng khi lướt qua đồng nghiệp ở hành lang, bước vào phòng họp, hoặc chào khách quen."
            },
            {
                "name": "Keirei (敬礼 - Chào trang trọng 30°)",
                "usage": "Dùng khi chào đối tác, khách hàng, cấp trên, bắt đầu và kết thúc buổi phỏng vấn tuyển dụng."
            },
            {
                "name": "Saikeirei (最敬礼 - Chào cung kính 45°)",
                "usage": "Dùng khi tạ lỗi sâu sắc (Shazai), cảm ơn đối tác lớn, hoặc trong các nghi lễ trang nghiêm."
            }
        ],
        "pro_tip": "Luôn dừng bước chân trước khi cúi chào, giữ lưng thẳng, mắt nhìn xuống sàn cách chân khoảng 1-2 mét."
    },
    {
        "id": "meishi",
        "title": "Nghi thức danh thiếp (名刺交換 - Meishi Koukan)",
        "icon": "CreditCard",
        "summary": "Danh thiếp được xem như chính gương mặt và linh hồn của đối phương. Tuyệt đối không được cẩu thả.",
        "details": [
            {
                "name": "Cầm bằng hai tay",
                "usage": "Luôn dùng cả hai tay để trao và nhận danh thiếp. Đặt danh thiếp ngang ngực."
            },
            {
                "name": "Không che logo và họ tên",
                "usage": "Khi nhận, ngón tay không được đè lên logo công ty hoặc họ tên đối tác. Nói: 頂戴いたします (Choudai itashimasu)."
            },
            {
                "name": "Đặt trang trọng trên bàn họp",
                "usage": "Khi ngồi vào bàn họp, đặt danh thiếp của khách lên trên hộp đựng danh thiếp của mình, không nhét ngay vào túi."
            }
        ],
        "pro_tip": "Nếu có nhiều người, hãy xếp danh thiếp theo đúng vị trí chỗ ngồi của từng người để tiện xưng hô chính xác."
    },
    {
        "id": "horenso",
        "title": "Nguyên tắc Ho-Ren-So (報・連・相)",
        "icon": "Share2",
        "summary": "Xương sống trong cách làm việc của người Nhật: Báo cáo - Liên lạc - Thảo luận.",
        "details": [
            {
                "name": "Houkoku (報告 - Báo cáo)",
                "usage": "Chủ động báo cáo tiến độ, kết quả công việc, đặc biệt là khi hoàn thành hoặc khi phát sinh sự cố."
            },
            {
                "name": "Renraku (連絡 - Liên lạc)",
                "usage": "Thông báo thông tin kịp thời, khách quan, không thêm bớt cảm xúc cá nhân."
            },
            {
                "name": "Soudan (相談 - Thảo luận)",
                "usage": "Khi gặp khó khăn không tự giải quyết được, phải chủ động xin ý kiến tư vấn từ cấp trên hoặc Senpai."
            }
        ],
        "pro_tip": "Quy tắc vàng: Khi báo cáo, luôn đưa kết luận trước (Ketsuron kara hanasu), sau đó mới đến nguyên nhân và chi tiết."
    },
    {
        "id": "nomikai",
        "title": "Văn hóa tiệc công ty (飲み会 - Nomikai)",
        "icon": "Wine",
        "summary": "Cơ hội thắt chặt tình đồng nghiệp và hiểu sếp hơn ngoài giờ làm việc.",
        "details": [
            {
                "name": "Chỗ ngồi Kamiza (上座) & Shimoza (下座)",
                "usage": "Người mới / cấp dưới luôn chủ động ngồi ở vị trí Shimoza (gần cửa ra vào nhất) để tiện gọi món và tiếp đồ uống."
            },
            {
                "name": "Rót đồ uống cho người khác",
                "usage": "Quan sát cốc của sếp/đồng nghiệp khi còn 1/3 thì chủ động rót mời. Cầm chai bằng hai tay."
            },
            {
                "name": "Lời cảm ơn vào sáng hôm sau",
                "usage": "Sáng hôm sau đi làm, câu đầu tiên gặp sếp/đồng nghiệp phải là: 昨日はごちそうさまでした (Kinoo wa gochisousama deshita)."
            }
        ],
        "pro_tip": "Dù trong tiệc có thể vui vẻ thoải mái, nhưng không bao giờ được thất lễ hoặc suồng sã quá mức."
    }
]
