"""Build seeds/seed-ai-judgment.json — CET-6 Section C, Passage One (Questions 46–50).

    python3 tools/build_ai_judgment.py

Article type "mcq" (仔细阅读). Word glosses live in tools/lex_ai_judgment.py.
"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

P = [
 [("Technology is never a neutral tool for achieving human ends.", "技术从来都不是实现人类目的的中立工具。"),
  ("Technological innovations reshape people as they use these innovations to control their environment.", "人们在利用技术创新掌控周围环境的同时，也在被这些创新重新塑造。"),
  ("Artificial intelligence, for example, is altering humanity.", "比如，人工智能就正在改变人类本身。")],
 [("While the term AI conjures up anxieties about killer robots or catastrophic levels of unemployment, there are other, deeper implications.", "虽然“人工智能”一词会让人联想到杀手机器人或灾难性的失业，但它还有其他更深层的影响。"),
  ("As AI increasingly shapes the human experience, how does this change what it means to be human?", "随着人工智能越来越多地塑造人类的经验，这会如何改变“身而为人”的意义？"),
  ("Central to the problem is a person's capacity to make choices, particularly judgments that have moral implications.", "问题的核心在于人做出选择的能力，尤其是做出具有道德意义的判断的能力。")],
 [("Aristotle argued that the capacity for making practical judgments depends on regularly making them—on habit and practice.", "亚里士多德认为，做出实践判断的能力取决于经常去做判断——取决于习惯和练习。"),
  ("We see the emergence of machines as substitute judges in a variety of everyday contexts as a potential threat to people learning how to effectively exercise judgment themselves.", "在我们看来，机器在各种日常情境中充当替代裁判，可能会威胁到人们学习如何自己有效地做出判断。")],
 [("In the workplace, managers routinely make decisions about who to hire or fire and which loan to approve, to name a few.", "在职场上，管理者经常要做各种决定，比如雇用或解雇谁、批准哪一笔贷款，等等。"),
  ("These are areas where algorithmic (算法的) prescription is replacing human judgment, and so people who might have had the chance to develop practical judgment in these areas no longer will.", "在这些领域，算法给出的指令正在取代人的判断，因此原本有机会在这些领域培养实践判断力的人，将不再有这样的机会。")],
 [("Recommendation engines, which are increasingly prevalent intermediaries in people's consumption of culture, may serve to constrain choice and minimize luck.", "推荐引擎在人们的文化消费中日益成为普遍的中介，它们可能会限制人们的选择，并把机缘巧合降到最低。"),
  ("By presenting consumers with algorithmically selected choices of what to watch, read, stream and visit next, companies are replacing human taste with machine taste.", "通过向消费者推送由算法挑选出的选项——接下来看什么、读什么、听什么、去哪里——公司正在用机器的品味取代人的品味。"),
  ("In one sense, this is helpful.", "从某种意义上说，这是有帮助的。"),
  ("After all, machines can survey a wider range of choices than any individual is likely to have the time or energy to do on their own.", "毕竟，机器能浏览的选择范围，比任何个人凭自己的时间和精力所能浏览的都要广。")],
 [("At the same time, though, this selection is optimizing for what people are likely to prefer based on what they've preferred in the past.", "但与此同时，这种筛选是根据人们过去的偏好，来优化推送他们可能喜欢的东西。"),
  ("We think there is some risk that people's options will be constrained by their past in a new and unanticipated way.", "我们认为存在一定的风险：人们的选择会以一种前所未有、意想不到的方式受制于自己的过去。")],
 [("As machine learning algorithms improve and as they train on more extensive data sets, larger parts of everyday life are likely to become utterly predictable.", "随着机器学习算法不断改进、在更大规模的数据集上进行训练，日常生活中越来越大的部分很可能会变得完全可以预测。"),
  ("The predictions are going to get better and better, and they will ultimately make common experiences more efficient and pleasant.", "预测会越来越准，最终会让日常经历变得更高效、更愉快。")],
 [("Algorithms could soon—if they don't already—have a better idea about which show you'd like to watch next and which job candidate you should hire than you do.", "算法可能很快就会——如果现在还没有的话——比你自己更清楚你接下来想看哪部节目、应该雇用哪位求职者。"),
  ("One day, humans may even find a way for machines to make these decisions without some of the biases that humans typically display.", "有一天，人类甚至可能找到办法，让机器在做这些决定时不带人类通常表现出的某些偏见。")],
 [("But to the extent that unpredictability is part of how people understand themselves and part of what people like about themselves, humanity is in the process of losing something significant.", "但既然不可预测性是人们理解自身的一部分，也是人们喜欢自己的地方之一，那么人类正在失去某种重要的东西。"),
  ("As they become more and more predictable, the creatures inhabiting the increasingly AI-mediated world will become less and less like us.", "随着变得越来越可以预测，生活在这个日益由人工智能来调节的世界里的生物，将会越来越不像我们。")],
]

ITEMS = {
 '46': {'en': 'What do we learn about the deeper implications of AI?', 'zh': '关于人工智能更深层的影响，我们可以得知什么？',
        'o': {'A': ('It is causing catastrophic levels of unemployment.', '它正在造成灾难性的失业。'),
              'B': ('It is doing physical harm to human operators.', '它正在对人类操作者造成身体伤害。'),
              'C': ('It is altering moral judgments.', '它正在改变道德判断。'),
              'D': ('It is reshaping humanity.', '它正在重塑人类。')}},
 '47': {'en': 'What is the consequence of algorithmic prescription replacing human judgment?', 'zh': '算法指令取代人的判断会带来什么后果？',
        'o': {'A': ('People lose the chance to cultivate the ability to make practical judgments.', '人们失去了培养实践判断能力的机会。'),
              'B': ('People are prevented from participating in making major decisions in the workplace.', '人们被阻止参与职场上的重大决策。'),
              'C': ('Managers no longer have the chance to decide which loan to approve.', '管理者不再有机会决定批准哪一笔贷款。'),
              'D': ('Managers do not need to take the trouble to determine who to hire or fire.', '管理者不必费心决定雇用或解雇谁。')}},
 '48': {'en': 'What may result from increasing application of recommendation engines in our consumption of culture?', 'zh': '推荐引擎越来越多地用于我们的文化消费，可能会导致什么结果？',
        'o': {'A': ('Consumers will have much limited choice.', '消费者的选择会非常有限。'),
              'B': ('Consumers will actually enjoy better luck.', '消费者实际上会更走运。'),
              'C': ('It will be easier to decide on what to enjoy.', '决定享受什么会变得更容易。'),
              'D': ("Humans will develop tastes similar to machines'.", '人类会形成和机器相似的品味。')}},
 '49': {'en': "What is likely to happen to larger parts of our daily life as machine learning algorithms improve?", 'zh': '随着机器学习算法的改进，我们日常生活中越来越大的部分可能会怎样？',
        'o': {'A': ('They will turn out to be more pleasant.', '它们会变得更加愉快。'),
              'B': ('They will repeat our past experience.', '它们会重复我们过去的经历。'),
              'C': ('They can be completely anticipated.', '它们能被完全预料。'),
              'D': ('They may become better and better.', '它们可能会变得越来越好。')}},
 '50': {'en': 'Why does the author say the creatures living in the more and more AI-mediated world will become increasingly unlike us?', 'zh': '作者为什么说，生活在日益由人工智能调节的世界里的生物会越来越不像我们？',
        'o': {'A': ('They will have lost the most significant human element of being intelligent.', '它们将失去作为人最重要的“聪明”这一要素。'),
              'B': ('They will no longer possess the human characteristic of being unpredictable.', '它们将不再具有人类“不可预测”这一特征。'),
              'C': ('They will not be able to understand themselves as we can do today.', '它们将无法像我们今天这样理解自己。'),
              'D': ('They will be deprived of what their predecessors were proud of about themselves.', '它们将被剥夺前人引以为傲的东西。')}},
}

BLANKS = {
 '46': {'ans': 'D', 'loc': [1, 1],
   'need': '定位词 deeper implications → 第 2 段第 1 句；答案在紧接着的第 2 句，并与第 1 段末句呼应。',
   'why': '第 2 段先用 While 让步：人们担心的是杀手机器人和失业（表层），“there are other, deeper implications”（作者要说的深层影响）。紧接着就点出：As AI increasingly shapes the human experience, how does this change what it means to be human?——AI 在改变“身而为人”的意义。这与第 1 段末句 Artificial intelligence … is altering humanity 一致。D 的 reshaping humanity = altering humanity / change what it means to be human。',
   'trap': 'C 最迷惑：它抓住了第 2 段末句的 moral implications。但原文说的是“问题核心在于人做选择、做判断的能力”，受影响的是这种能力，而不是“改变道德判断”本身。',
   'tip': '让步结构 While / Although A, B：A 是别人的担心或表层现象，作者真正的观点在 B。',
   'ox': {'A': '失业出现在 While 引导的让步从句里，是人们的“表层担忧”，作者紧接着说还有更深层的影响，所以 A 恰恰不是答案。',
          'B': '原文只说 AI 让人联想到“杀手机器人”的焦虑，没有提到对人类操作者造成身体伤害。',
          'C': '原文说问题的核心是人“做选择、做道德判断的能力”，不是 AI 改变了道德判断本身，把“能力”换成了“判断”。'},
   'ot': {'A': 'swap', 'B': 'infer', 'C': 'swap'}},
 '47': {'ans': 'A', 'loc': [3, 1],
   'need': '定位词 algorithmic prescription replacing human judgment → 第 4 段第 2 句。',
   'why': '第 4 段第 2 句：algorithmic prescription is replacing human judgment, and so people who might have had the chance to develop practical judgment in these areas no longer will。and so 引出结果：人们不再有机会培养实践判断力。A 与之对应：lose the chance ↔ no longer will (have the chance)，cultivate ↔ develop，the ability to make practical judgments ↔ practical judgment。这也呼应第 3 段亚里士多德的观点：判断力要靠经常做判断来养成。',
   'trap': 'C 和 D 都用了原文的例子（批准贷款、雇用解雇），但原文强调的后果是“失去培养判断力的机会”，不是管理者能不能决定、省不省事。',
   'tip': '问“后果 / 结果”的题，在原因句之后找 so、and so、thus、therefore 引出的部分。',
   'ox': {'B': '原文没有说人们被“阻止参与”职场重大决策，是由“算法取代判断”过度推出的结论。',
          'C': '批准贷款只是原文列举的例子之一（to name a few），用一个例子代替了整体结论，而且原文强调的是“培养判断力的机会”。',
          'D': '原文对此是担忧的态度，D 说管理者“不必费心”，把作者眼中的损失说成了好处。'},
   'ot': {'B': 'infer', 'C': 'part', 'D': 'flip'}},
 '48': {'ans': 'A', 'loc': [4, 0],
   'need': '定位词 recommendation engines / consumption of culture → 第 5 段第 1 句，并参考第 6 段末句。',
   'why': '第 5 段第 1 句：Recommendation engines … may serve to constrain choice and minimize luck。题干 What may result 对应原文 may serve to，constrain choice（限制选择）↔ A have much limited choice。第 6 段末句再次强调：people\'s options will be constrained by their past。',
   'trap': 'C 容易被第 5 段后半段迷惑：作者说 In one sense, this is helpful，机器能浏览更多选择。但那是让步，而且只说机器看得更多，并没有说“决定享受什么更容易”。',
   'tip': 'may serve to / may lead to / is likely to 这类表示“可能导致”的句子，往往就是“可能结果”题的答案句。',
   'ox': {'B': '原文是 minimize luck（把运气、机缘降到最低），B 说“更走运”，方向正好相反。',
          'C': '原文说机器能浏览的选项更多，“从某种意义上有帮助”，并没有说人们做决定会更容易。',
          'D': '原文是公司用机器的品味“取代”人的品味，不是人会形成和机器相似的品味。'},
   'ot': {'B': 'flip', 'C': 'infer', 'D': 'swap'}},
 '49': {'ans': 'C', 'loc': [6, 0],
   'need': '定位词 machine learning algorithms improve / larger parts of everyday life → 第 7 段第 1 句。',
   'why': '第 7 段第 1 句：As machine learning algorithms improve … larger parts of everyday life are likely to become utterly predictable。题干与原文几乎逐词对应，答案就在同一句：utterly predictable ↔ completely anticipated（utterly = completely，predictable = can be anticipated）。',
   'trap': 'A 和 D 都出自紧接着的第 2 句，但那句的主语是 the predictions（预测会越来越好），让 common experiences 更高效、更愉快——说的不是“日常生活的大部分”本身会怎样。',
   'tip': '题干和原文句子几乎逐词对应时，答案就在同一句里，不要被下一句的细节带跑。',
   'ox': {'A': '原文说“预测”会让日常经历更愉快，主语和题干不同，而且下一句才提到；题干问的是日常生活大部分本身的变化。',
          'B': '第 6 段说选择会受过去的偏好约束，不是生活会“重复过去的经历”，把两处信息拼在了一起。',
          'D': '原文中越来越好的是 predictions（预测），不是日常生活，主语被换掉了。'},
   'ot': {'A': 'swap', 'B': 'swap', 'D': 'swap'}},
 '50': {'ans': 'B', 'loc': [8, 1],
   'need': '定位词 creatures / AI-mediated world / less and less like us → 末段第 2 句，原因在末段第 1 句。',
   'why': '末段第 1 句：unpredictability is part of how people understand themselves and part of what people like about themselves——不可预测性是人之为人的一部分。第 2 句：As they become more and more predictable, the creatures … will become less and less like us。变得可预测，就失去了“不可预测”这一人的特征，所以越来越不像我们。B: no longer possess the human characteristic of being unpredictable。',
   'trap': 'C 抓住了 understand themselves，但原文只说不可预测性是人们理解自己的“一部分”，并没有说将来的生物“无法理解自己”。',
   'tip': '问 why 的题，先在原文找到题干原句，原因常在同一句的 as / because 从句里或前一句。',
   'ox': {'A': '原文说失去的重要东西是 unpredictability（不可预测性），不是“聪明”。',
          'C': '原文只说不可预测性是人们理解自己的一部分，没有说它们将无法理解自己，推得过远。',
          'D': '原文 what people like about themselves 是“人们喜欢自己的地方”，没有提到“前人”，也不是“被剥夺”。'},
   'ot': {'A': 'swap', 'C': 'infer', 'D': 'infer'}},
}

art = {
 'id': 'ai-judgment', 'type': 'mcq',
 'title': 'Technology Is Never a Neutral Tool', 'zh': '技术从来不是中立的工具',
 'source': 'CET-6 · Part III Reading · Section C 仔细阅读 Passage One（集训刷题卷）',
 'createdAt': 1791892800000,
 'paragraphs': [{'sentences': [{'en': e, 'zh': z} for e, z in p]} for p in P],
 'items': {n: {'en': v['en'], 'zh': v['zh'], 'o': {L: {'en': e, 'zh': z} for L, (e, z) in v['o'].items()}} for n, v in ITEMS.items()},
 'options': {L: {'w': L, 'pos': '选项', 'zh': '', 'en': ''} for L in 'ABCD'},
 'blanks': {n: {'cands': [], **b} for n, b in BLANKS.items()},
}
for n, b in art['blanks'].items():
    p, s = b['loc']; assert art['paragraphs'][p]['sentences'][s]['en']

ns = {}
exec(open(os.path.join(ROOT, 'tools', 'lex_ai_judgment.py'), encoding='utf-8').read(), ns)
toks = set()
for p in P:
    for e, z in p:
        for t in re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)*", e): toks.add(t.lower())
missing = sorted(t for t in toks if t not in ns['LEX'])
if missing: print('no gloss for:', ' '.join(missing))
art.update(lex=ns['LEX'], keys=ns['KEYS'], tips=ns['TIPS'])
with open(os.path.join(ROOT, 'seeds', 'seed-ai-judgment.json'), 'w', encoding='utf-8') as f:
    json.dump(art, f, ensure_ascii=False, indent=1)
print('wrote seeds/seed-ai-judgment.json ·', len(toks), 'word types')
