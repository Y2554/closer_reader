"""Build seeds/seed-reading-wars.json — CET-6 Section C, Passage Two (Questions 51–55).

    python3 tools/build_reading_wars.py

Article type "mcq" (仔细阅读). Word glosses live in tools/lex_reading_wars.py.
"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

P = [
 [("Phonics, which involves sounding out words syllable (音节) by syllable, is the best way to teach children to read.", "自然拼读法要求逐个音节地把单词读出来，它是教孩子阅读的最佳方法。"),
  ("But in many classrooms, this can be a dirty word.", "但在许多课堂上，这可能是个令人避讳的词。"),
  ("So much so that some teachers have had to sneak phonics teaching materials into the classroom.", "以至于一些老师不得不把自然拼读的教材偷偷带进教室。"),
  ("Most American children are taught to read in a way that study after study has found to be wrong.", "大多数美国孩子学习阅读的方式，已被一项又一项研究证明是错误的。")],
 [("The consequences of this are striking.", "这样做的后果触目惊心。"),
  ("Less than half of all American adults were proficient readers in 2017.", "2017 年，美国成年人中能熟练阅读的还不到一半。"),
  ("American fourth graders rank 15th on the Progress in International Literacy Study, an international exam.", "在国际性考试“国际阅读素养进展研究”中，美国四年级学生排名第 15 位。")],
 [("America is stuck in a debate about teaching children to read that has been going on for decades.", "美国陷入了一场关于如何教孩子阅读的争论，这场争论已经持续了几十年。"),
  ("Some advocate teaching symbol-sound relationships (the sound k can be spelled as c, k, ck, or ch), known as phonics.", "一些人主张教授符号与读音的对应关系（比如 k 这个音可以拼写为 c、k、ck 或 ch），也就是自然拼读法。"),
  ("Others support an immersive approach (using pictures of a cat to learn the word cat), known as \"whole language\".", "另一些人支持沉浸式教学法（比如借助猫的图片来学 cat 这个词），也就是“整体语言教学法”。"),
  ("Most teachers today, almost three out of four according to a survey by the EdWeek Research Centre in 2019, use a mix called \"balanced literacy\".", "如今大多数老师——根据 EdWeek 研究中心 2019 年的一项调查，几乎四分之三的老师——使用一种叫作“平衡读写”的混合方法。"),
  ("This combination of methods is ineffective.", "这种多种方法的组合是无效的。")],
 [("\"You can't sprinkle in a little phonics,\" says Tenette Smith, executive director of elementary education and reading at Mississippi's education department.", "“你不能只是零星地加一点自然拼读，”密西西比州教育厅小学教育与阅读执行主任泰内特·史密斯说。"),
  ("\"It has to be systematic and explicitly taught.\"", "“它必须系统地、明确地教授。”")],
 [("Mississippi, often behind in social policy, has set an example here.", "在社会政策方面常常落后的密西西比州，在这方面却树立了榜样。"),
  ("In a state once notorious for its low reading scores, the Mississippi state legislature passed new literacy standards in 2013.", "这个州曾因阅读成绩低下而臭名昭著，2013 年，密西西比州议会通过了新的读写能力标准。"),
  ("Since then Mississippi has seen remarkable gains.", "从那以后，密西西比州取得了显著进步。"),
  ("Its fourth graders have moved from 49th (out of 50 states) to 29th on the National Assessment of Educational Progress, a nationwide exam.", "在全国性考试“国家教育进步评估”中，该州四年级学生的排名从第 49 位（共 50 个州）升到了第 29 位。"),
  ("In 2019 it was the only state to improve its scores.", "2019 年，它是唯一一个成绩有所提高的州。"),
  ("For the first time since measurement began, Mississippi's pupils are now average readers, a remarkable achievement in such a poor state.", "自开始测评以来，密西西比州的学生第一次达到了平均阅读水平，对于这样一个贫穷的州来说，这是了不起的成就。")],
 [("Mississippi's success is attributed to implementing reading methods supported by a body of research known as the science of reading.", "密西西比州的成功归功于采用了有大量研究支持的阅读教学方法，这些研究被称为“阅读科学”。"),
  ("In 1997 Congress requested the National Institute of Child Health and Human Development and the Department of Education to convene a National Reading Panel to end the \"reading wars\" and synthesize the evidence.", "1997 年，国会要求国家儿童健康与人类发展研究所和教育部召集一个国家阅读专家小组，以结束“阅读之战”并综合各方证据。"),
  ("The panel found that phonics, along with explicit instruction in phonemic (音位的) awareness, fluency and comprehension, worked best.", "专家小组发现，自然拼读法再加上对音位意识、阅读流利度和理解力的明确指导，效果最好。")],
 [("Yet over two decades on, \"balanced literacy\" is still being taught in classrooms.", "然而二十多年过去了，课堂上教的仍然是“平衡读写”。"),
  ("But advances in statistics and brain imaging have disproved the whole-language method.", "但统计学和脑成像技术的进步已经证明整体语言教学法是错误的。"),
  ("To the teacher who is a proficient reader, literacy seems like a natural process that requires educated guessing, rather than the deliberate process emphasized by phonics.", "对于本身阅读熟练的老师来说，读写能力似乎是一个需要凭经验推测的自然过程，而不是自然拼读法所强调的那种有意识的学习过程。"),
  ("Teachers can imagine that they learned to read through osmosis (潜移默化) when they were children.", "老师们可能以为自己小时候是在潜移默化中学会阅读的。"),
  ("Without proper training, they bring this to classrooms.", "如果没有接受恰当的培训，他们就会把这种想法带进课堂。")],
]

ITEMS = {
 '51': {'en': 'What do we learn about phonics in many American classrooms?', 'zh': '关于自然拼读法在美国许多课堂上的情况，我们可以得知什么？',
        'o': {'A': ('It is ill reputed.', '它名声不好。'),
              'B': ('It is mostly misapplied.', '它大多被误用。'),
              'C': ('It is arbitrarily excluded.', '它被随意排除在外。'),
              'D': ('It is misrepresented.', '它被歪曲了。')}},
 '52': {'en': 'What has America been witnessing for decades?', 'zh': '几十年来，美国一直在经历什么？',
        'o': {'A': ('An obsession with innovating teaching methodologies of reading.', '对创新阅读教学方法的痴迷。'),
              'B': ('An enduring debate over the approach to teaching children to read.', '一场关于如何教孩子阅读的旷日持久的争论。'),
              'C': ("An increasing concern with many children's inadequacy in literacy.", '人们越来越担心许多孩子读写能力不足。'),
              'D': ('An ever-forceful advocacy of a combined method for teaching reading.', '对综合阅读教学法越来越有力的倡导。')}},
 '53': {'en': 'Why does Tenette Smith think a combination of teaching methods is ineffective?', 'zh': '泰内特·史密斯为什么认为多种教学方法相结合是无效的？',
        'o': {'A': ('Elementary school children will be frustrated when taught with several methods combined.', '用多种方法结合来教，小学生会感到挫败。'),
              'B': ('Phonics has to be systematically applied and clearly taught to achieve the desired effect.', '自然拼读必须系统地运用、清楚地教授，才能达到预期效果。'),
              'C': ('Sprinkling in a little phonics deters the progress of even adequately motivated children.', '零星地加一点自然拼读，甚至会阻碍有足够学习动力的孩子进步。'),
              'D': ("Balanced literacy fails to sustain children's interest in developing a good reading habit.", '平衡读写法无法维持孩子养成良好阅读习惯的兴趣。')}},
 '54': {'en': "What does the author say Mississippi's success is attributed to?", 'zh': '作者说密西西比州的成功归功于什么？',
        'o': {'A': ('Convening a National Reading Panel to synthesize research evidence.', '召集国家阅读专家小组来综合研究证据。'),
              'B': ('Placing sufficient emphasis upon both fluency and comprehension.', '对流利度和理解力都给予足够的重视。'),
              'C': ('Adopting scientifically grounded approaches to teaching reading.', '采用有科学依据的阅读教学方法。'),
              'D': ('Obtaining support from Congress to upgrade teaching methods.', '获得国会支持来升级教学方法。')}},
 '55': {'en': 'What have advances in statistics and brain imaging proved ineffective?', 'zh': '统计学和脑成像技术的进步证明了什么是无效的？',
        'o': {'A': ('The teaching of symbol-sound relationships.', '教授符号与读音的对应关系。'),
              'B': ('Explicit instruction in phonemic awareness.', '对音位意识的明确指导。'),
              'C': ('Efforts to end the reading wars.', '结束阅读之战的努力。'),
              'D': ('The immersive approach.', '沉浸式教学法。')}},
}

BLANKS = {
 '51': {'ans': 'A', 'loc': [0, 1],
   'need': '定位词 phonics / many classrooms → 第 1 段第 2、3 句。',
   'why': '第 1 段第 2 句：But in many classrooms, this can be a dirty word。a dirty word 指“令人反感、被避讳的说法”；第 3 句进一步说，有些老师甚至不得不把自然拼读教材“偷偷”带进教室（sneak … into the classroom），可见它在课堂上名声不好、不受待见。A ill reputed（名声不好）是 a dirty word 的同义改写。',
   'trap': 'C 容易被 sneak（偷偷带进）误导，以为自然拼读被“排除”了。但原文只说明它不受欢迎，没有说被“随意”排除。',
   'tip': '题干问“我们了解到什么”时，常考对习语、比喻的同义转述（a dirty word → ill reputed）。',
   'ox': {'B': '原文第 4 句说的是大多数孩子学阅读的“方式”是错的，不是自然拼读被误用；张冠李戴。',
          'C': '原文只说老师要偷偷带教材进课堂，可见它不受待见，并没有说它被“随意排除”。',
          'D': '原文没有提到自然拼读被歪曲或曲解。'},
   'ot': {'B': 'swap', 'C': 'infer', 'D': 'infer'}},
 '52': {'ans': 'B', 'loc': [2, 0],
   'need': '定位词 for decades → 第 3 段第 1 句 has been going on for decades。',
   'why': '第 3 段第 1 句：America is stuck in a debate about teaching children to read that has been going on for decades。debate ↔ debate；has been going on for decades ↔ enduring（持久的）；about teaching children to read ↔ over the approach to teaching children to read。后文分别介绍两派主张（phonics 和 whole language），说明争论的焦点就是教学方法。',
   'trap': 'D 提到了 combined method，对应原文的 balanced literacy，但原文只说多数老师在用，作者认为它无效，并没有“越来越有力的倡导”。',
   'tip': '题干中的时间状语（for decades）往往能直接定位到原文含同一时间状语的句子。',
   'ox': {'A': '原文说的是两派方法之争，不是“痴迷于创新教学方法”。',
          'C': '第 2 段提到成年人阅读能力不足的后果，但没有说“几十年来越来越担心”，也不是题干问的那件事。',
          'D': '原文只说大多数老师在用混合方法，并没有“越来越有力的倡导”，作者还明确说它无效。'},
   'ot': {'A': 'infer', 'C': 'swap', 'D': 'infer'}},
 '53': {'ans': 'B', 'loc': [3, 1],
   'need': '定位词 Tenette Smith → 第 4 段（紧接第 3 段末句“This combination of methods is ineffective”）。',
   'why': '第 3 段末句说混合方法无效，第 4 段引用史密斯的话说明原因：You can\'t sprinkle in a little phonics… It has to be systematic and explicitly taught。意思是自然拼读不能零星地掺一点，必须系统、明确地教，才有效果。B 的 systematically applied ↔ systematic，clearly taught ↔ explicitly taught。',
   'trap': 'C 直接照搬了 sprinkle in a little phonics，但加上了原文没有的“阻碍有学习动力的孩子进步”。',
   'tip': '引语类题目先找到人名，再把引语里的形容词、副词逐个与选项对照（systematic → systematically，explicitly → clearly）。',
   'ox': {'A': '原文没有提到孩子会因为多种方法结合而受挫。',
          'C': '借用了原文 sprinkle in a little phonics，但“阻碍有足够动力的孩子进步”是原文没有的内容。',
          'D': '原文没有提到阅读兴趣或阅读习惯。'},
   'ot': {'A': 'infer', 'C': 'infer', 'D': 'infer'}},
 '54': {'ans': 'C', 'loc': [5, 0],
   'need': '定位词 Mississippi\'s success is attributed to → 第 6 段第 1 句（题干几乎照抄原文）。',
   'why': '第 6 段第 1 句：Mississippi\'s success is attributed to implementing reading methods supported by a body of research known as the science of reading。implementing ↔ adopting；reading methods ↔ approaches to teaching reading；supported by a body of research known as the science of reading ↔ scientifically grounded（有科学依据的）。',
   'trap': 'A 和 D 都是第 6 段第 2 句里出现的内容，但召集阅读专家小组的是国会，不是密西西比州，而且那件事发生在 1997 年。',
   'tip': '题干和原文几乎一样时，答案在同一句里；同段后面出现的其他动作，往往是“张冠李戴”的干扰项。',
   'ox': {'A': '召集国家阅读专家小组的是国会（1997 年），不是密西西比州成功的原因。',
          'B': '流利度和理解力只是专家小组发现的有效要素中的两项，用部分代替了整体。',
          'D': '原文说国会要求召集专家小组，没有说密西西比得到国会支持来升级教学方法。'},
   'ot': {'A': 'swap', 'B': 'part', 'D': 'swap'}},
 '55': {'ans': 'D', 'loc': [6, 1],
   'need': '定位词 advances in statistics and brain imaging → 第 7 段第 2 句。',
   'why': '第 7 段第 2 句：advances in statistics and brain imaging have disproved the whole-language method。disproved ↔ proved ineffective。第 3 段已经交代 whole language 就是 an immersive approach（用猫的图片学 cat），所以 D The immersive approach 是 whole-language method 的同义替换。',
   'trap': 'A 的 symbol-sound relationships 就是第 3 段定义的 phonics，是被证明有效的方法，方向正好相反。',
   'tip': '跨段同义替换：选项常用文中前面给出的“定义”来替换后面的“名称”，要回头核对。',
   'ox': {'A': 'symbol-sound relationships 就是自然拼读法（phonics），它被证明有效，不是无效。',
          'B': '对音位意识的明确指导是专家小组认为“效果最好”的组成部分，方向相反。',
          'C': '结束阅读之战是 1997 年国会召集专家小组的目的，与统计学和脑成像的进步无关。'},
   'ot': {'A': 'flip', 'B': 'flip', 'C': 'swap'}},
}

art = {
 'id': 'reading-wars', 'type': 'mcq',
 'title': "America's Reading Wars", 'zh': '美国的“阅读之战”',
 'source': 'CET-6 · Part III Reading · Section C 仔细阅读 Passage Two（集训刷题卷）',
 'createdAt': 1791896400000,
 'paragraphs': [{'sentences': [{'en': e, 'zh': z} for e, z in p]} for p in P],
 'items': {n: {'en': v['en'], 'zh': v['zh'], 'o': {L: {'en': e, 'zh': z} for L, (e, z) in v['o'].items()}} for n, v in ITEMS.items()},
 'options': {L: {'w': L, 'pos': '选项', 'zh': '', 'en': ''} for L in 'ABCD'},
 'blanks': {n: {'cands': [], **b} for n, b in BLANKS.items()},
}
for n, b in art['blanks'].items():
    p, s = b['loc']; assert art['paragraphs'][p]['sentences'][s]['en']

ns = {}
exec(open(os.path.join(ROOT, 'tools', 'lex_reading_wars.py'), encoding='utf-8').read(), ns)
toks = set()
for p in P:
    for e, z in p:
        for t in re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)*", e): toks.add(t.lower())
missing = sorted(t for t in toks if t not in ns['LEX'])
if missing: print('no gloss for:', ' '.join(missing))
art.update(lex=ns['LEX'], keys=ns['KEYS'], tips=ns['TIPS'])
with open(os.path.join(ROOT, 'seeds', 'seed-reading-wars.json'), 'w', encoding='utf-8') as f:
    json.dump(art, f, ensure_ascii=False, indent=1)
print('wrote seeds/seed-reading-wars.json ·', len(toks), 'word types')
