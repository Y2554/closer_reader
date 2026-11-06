"""Build seeds/seed-gratitude.json (CET-6 Section B: The Lifesaving Power of Gratitude).

    python3 tools/build_gratitude.py

Step 1 writes the article without word glosses to seeds/seed-gratitude.base.json.
Step 2 merges LEX / KEYS / TIPS from tools/lex_gratitude.py into seeds/seed-gratitude.json,
which is the document stored at articles/gratitude-lifesaving.
A template for hand-building another article in the same shape.
"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = [
 ('A', [
  ("Gratitude may be more beneficial than we commonly suppose.", "感恩带来的益处可能比我们通常以为的更大。"),
  ("One recent study asked participants to write a note of thanks to someone and then estimate how surprised and happy the recipient would feel—an impact that they consistently underestimated.", "最近的一项研究让参与者给某人写一封感谢信，再估计收信人会有多惊喜、多开心——而参与者始终低估了这种影响。"),
  ("Another study assessed the health benefits of writing thank-you notes.", "另一项研究评估了写感谢信对健康的益处。"),
  ("The researchers found that writing as few as three weekly thank-you notes over the course of three weeks improved life satisfaction, increased happy feelings and reduced symptoms of depression.", "研究人员发现，在三周内每周只写三封感谢信，就能提高生活满意度、增加愉悦感并减轻抑郁症状。")]),
 ('B', [
  ("While this research into gratitude is relatively new, the principles involved are anything but.", "虽然这类关于感恩的研究相对较新，但其中涉及的原理却一点也不新。"),
  ("Students of mine in a political philosophy course at Indiana University are reading Daniel Defoe's 300-year-old Robinson Crusoe, often regarded as the first novel published in English.", "我在印第安纳大学政治哲学课上的学生正在读丹尼尔·笛福写于 300 年前的《鲁滨逊漂流记》，这部作品常被视为第一部用英语出版的小说。"),
  ("Left alone on an unknown island with no apparent prospect of rescue or escape, Crusoe has much to lament (悲叹).", "鲁滨逊独自被困在一座陌生的岛上，看不到任何获救或逃离的希望，他有太多可以悲叹的事。"),
  ("But instead of giving in to despair, he makes a list of things for which he is grateful, including the fact that he is the sole survivor from the shipwreck (海难) and has been able to salvage many useful items from the wreckage.", "但他没有陷入绝望，而是列出了一张值得感恩的清单，包括他是那场海难中唯一的幸存者，而且还从残骸中抢救出了许多有用的物品。")]),
 ('C', [
  ("Defoe's masterpiece, which is often ranked as one of the world's greatest novels, provides a portrait of gratitude in action that is as timely and relevant today as it has ever been.", "笛福的这部杰作常被列为世界上最伟大的小说之一，它描绘了感恩的实际践行，这一描绘在今天依然和以往任何时候一样及时、切题。"),
  ("It is also one with which contemporary psychology and medicine are just beginning to catch up.", "当代心理学和医学也才刚刚开始赶上它的认识。"),
  ("Simply put, for most of us, it is far more helpful to focus on the things in life for which we can express gratitude than those that incline us toward resentment and lamentation.", "简单地说，对我们大多数人而言，关注生活中值得感恩的事，远比关注那些让我们心生怨恨和悲叹的事有益得多。")]),
 ('D', [
  ("When we focus on the things we regret, such as failed relationships, family disputes, and setbacks in career and finance, we tend to become more regretful.", "当我们关注那些令人遗憾的事，比如失败的感情、家庭纠纷以及事业和财务上的挫折，我们往往会变得更加懊悔。"),
  ("Conversely, when we focus on the things we are grateful for, a greater sense of happiness tends to spread through our lives.", "相反，当我们关注值得感恩的事，更强烈的幸福感往往会在生活中蔓延开来。"),
  ("And while no one would argue for cultivating a false sense of blessedness, there is mounting evidence that counting our blessings is one of the best habits we can develop to promote mental and physical health.", "虽然没有人会主张去培养一种虚假的幸福感，但越来越多的证据表明，细数自己拥有的幸运是我们能养成的促进身心健康的最佳习惯之一。")]),
 ('E', [
  ("Gratitude has long enjoyed a privileged position in many of the world's cultural traditions.", "长期以来，感恩在世界许多文化传统中都享有特殊的地位。"),
  ("For example, some ancient Western philosophers counsel gratitude that is both enduring and complete, and some Eastern thinkers portray it as not merely an attitude but a virtue to be put into practice.", "例如，一些古代西方哲学家劝导人们怀有持久而完整的感恩之心，一些东方思想家则把感恩描述为不仅是一种态度，更是一种需要付诸实践的美德。")]),
 ('F', [
  ("Recent scientific studies support these ancient teachings.", "最近的科学研究支持了这些古老的教诲。"),
  ("Individuals who regularly engage in gratitude exercises, such as counting their blessings or expressing gratitude to others, exhibit increased satisfaction with relationships and fewer symptoms of physical illness.", "经常做感恩练习的人，比如细数自己的幸运或向他人表达感谢，对人际关系的满意度更高，身体疾病的症状也更少。"),
  ("And the benefits are not only psychological and physical.", "而且这些益处不仅是心理上和身体上的。"),
  ("They may also be moral—those who practice gratitude also view their lives less materialistically and suffer from less envy.", "它们也可能是道德上的——践行感恩的人看待生活时也更少物质化，更少受嫉妒之苦。")]),
 ('G', [
  ("There are multiple explanations for such benefits of gratefulness.", "感恩之所以有这些益处，有多种解释。"),
  ("One is the fact that expressing gratitude encourages others to continue being generous, thus promoting a virtuous cycle of goodness in relationships.", "一种解释是，表达感谢会鼓励他人继续慷慨待人，从而在人际关系中形成善意的良性循环。"),
  ("Similarly, grateful people may be more likely to reciprocate (回报) with acts of kindness of their own.", "同样，心怀感恩的人也更可能用自己的善举来回报他人。"),
  ("Broadly speaking, a community in which people feel grateful to one another is likely to be a more pleasant place to live than one characterized by mutual suspicion and resentment.", "总的来说，一个人们彼此心怀感激的社区，很可能比一个充满相互猜疑和怨恨的社区更宜居。"),
  ("The beneficial effects of gratitude may extend even further.", "感恩的有益影响还可能延伸得更远。"),
  ("For example, when many people feel good about what someone else has done for them, they experience a sense of being lifted up, with a corresponding enhancement of their regard for humanity.", "例如，当许多人因别人为自己所做的事而感到温暖时，他们会有一种被提升的感觉，对人性的看法也相应地更加积极。"),
  ("Some are inspired to attempt to become better people themselves, doing more to help bring out the best in others and bringing more goodness into the world around them.", "有些人会受到鼓舞，努力让自己成为更好的人，更多地帮助他人发挥出最好的一面，为周围的世界带来更多善意。")]),
 ('H', [
  ("Gratitude also tends to strengthen a sense of connection with others.", "感恩还往往会增强人与人之间的联系感。"),
  ("When people want to do good things that inspire gratitude, the level of dedication in relationships tends to grow and relationships seem to last longer.", "当人们想做一些能激发感恩的好事时，他们在关系中的投入程度往往会提高，关系似乎也会维持得更久。"),
  ("And when people feel more connected, they are more likely to choose to spend their time with one another and demonstrate their feelings of affection in daily acts.", "而当人们感到彼此联系更紧密时，他们更可能选择共度时光，并在日常行动中表达彼此的情谊。")]),
 ('I', [
  ("Of course, acts of kindness can also foster discomfort.", "当然，善举也可能带来不适。"),
  ("For example, if people feel they are not worthy of kindness or suspect that some ulterior (别有用心的) motive lies behind it, the benefits of gratitude will not be realized.", "例如，如果人们觉得自己不配得到善待，或者怀疑善意背后另有图谋，感恩的益处就无法实现。"),
  ("Likewise, receiving a kindness can give rise to a sense of indebtedness, leaving beneficiaries feeling that they must now pay back whatever good they have received.", "同样，接受别人的好意也可能产生一种亏欠感，让受惠者觉得自己现在必须偿还所得到的一切好处。"),
  ("Gratitude can flourish only if people are secure enough in themselves and sufficiently trusting to allow it to do so.", "只有当人们内心足够安定、足够信任他人时，感恩才能蓬勃生长。"),
  ("Another obstacle to gratitude is often called a sense of entitlement.", "感恩的另一个障碍常被称为“理所应得感”。"),
  ("Instead of experiencing a benefaction (善行) as a good turn, people sometimes regard it as a mere payment of what they are owed, for which no one deserves any moral credit.", "人们有时不把别人的善行当作一份好意，而只把它看作偿还自己应得的东西，因此觉得谁都不值得在道德上被称赞。")]),
 ('J', [
  ("There are a number of practical steps anyone can take to promote a sense of gratitude.", "任何人都可以采取一些切实可行的步骤来增强感恩之心。"),
  ("One is simply spending time on a regular basis thinking about someone who has made a difference, or perhaps writing a thank-you note or expressing such gratitude in person.", "一种做法很简单：定期花些时间想一想对自己有重要影响的人，或者写一封感谢信，或当面表达这种感激。"),
  ("Others are found in ancient religious disciplines, such as reflecting on benefactions received from another person or actually praying for the health and happiness of a benefactor.", "另一些做法来自古老的宗教修行，比如回想从他人那里得到的善行，或真正为恩人的健康和幸福祈祷。"),
  ("In addition to benefactions received, it is also possible to focus on opportunities to do good oneself, whether those acted on in the past or hoped for in the future.", "除了得到的善行，人们也可以关注自己行善的机会，无论是过去已经付诸行动的，还是期望将来能有的。"),
  ("Some people are most grateful not for what others have done for them but for chances they enjoyed to help others.", "有些人最感激的不是别人为他们做了什么，而是自己曾有机会帮助他人。"),
  ("In regularly reflecting on the things in his life he is grateful for, Defoe's Crusoe believes that he becomes a far better person than he would have been had he remained in the society from which he originally set out on his voyage.", "笛福笔下的鲁滨逊经常反思生活中值得感恩的事，他相信，比起留在当初出海时离开的那个社会，自己因此成为了一个好得多的人。")]),
 ('K', [
  ("Reflecting on generosity and gratitude, the great basketball coach John Wooden once offered two counsels to his players and students.", "伟大的篮球教练约翰·伍登在思考慷慨和感恩时，曾给他的队员和学生两条忠告。"),
  ("First, he said, \"It is impossible to have a perfect day unless you have done something for someone who will never be able to repay you.\"", "第一条，他说：“除非你为一个永远无法回报你的人做了些什么，否则你不可能拥有完美的一天。”"),
  ("In saying this, Wooden sought to promote purely generous acts, as opposed to those performed with an expectation of reward.", "伍登这样说，是想提倡纯粹慷慨的行为，而不是那些期待回报的行为。"),
  ("Second, he said, \"Give thanks for your blessings every day.\"", "第二条，他说：“每天都为你拥有的幸运而感恩。”")]),
 ('L', [
  ("Some faith traditions incorporate such practices into the rhythm of daily life.", "一些宗教传统把这类做法融入了日常生活的节奏之中。"),
  ("For example, adherents of some religions offer prayers of thanksgiving every morning before rising and every night before lying down to sleep.", "例如，一些宗教的信徒每天早上起床前和每晚睡觉前都会做感恩祈祷。"),
  ("Others offer thanks throughout the day, such as before meals.", "还有些人在一天中随时表达感谢，比如在饭前。"),
  ("Other less frequent special events, such as births, deaths and marriages, may also be heralded by such prayers.", "其他不那么频繁的特殊事件，如出生、死亡和婚姻，也可能以这样的祈祷来宣告。")]),
 ('M', [
  ("When Defoe depicted Robinson Crusoe making thanksgiving a daily part of his island life, he was anticipating findings in social science and medicine that would not appear for hundreds of years.", "笛福描写鲁滨逊把感恩变成岛上生活的日常时，他预见到了社会科学和医学几百年后才会出现的发现。"),
  ("Yet he was also reflecting the wisdom of religious and philosophical traditions that extend back thousands of years.", "然而，他也在体现可以追溯到几千年前的宗教和哲学传统的智慧。"),
  ("Gratitude is one of the healthiest and most nourishing of all states of mind, and those who adopt it as a habit are enriching not only their own lives but also the lives of those around them.", "感恩是所有心态中最健康、最滋养人心的心态之一，把它养成习惯的人不仅丰富了自己的生活，也丰富了身边人的生活。")]),
]
ITEMS = {
 '36': ("It does us far more good to focus on things we can be grateful for than what makes us sad and resentful.", "关注我们可以感恩的事，比关注让我们难过和怨恨的事，对我们有益得多。"),
 '37': ("The beneficial impacts of gratitude can extend from individuals to their community and to the wider society.", "感恩的有益影响可以从个人延伸到社区，再延伸到更广泛的社会。"),
 '38': ("The participants in a recent study repeatedly underestimated the positive effect on those who received thank-you notes.", "最近一项研究的参与者一再低估了感谢信对收信人的积极影响。"),
 '39': ("Good deeds can sometimes make people feel uncomfortable.", "善行有时会让人感到不自在。"),
 '40': ("People who regularly express gratitude can benefit in moral terms.", "经常表达感恩的人能在道德层面受益。"),
 '41': ("A basketball coach advocated performing generous acts without expecting anything in return.", "一位篮球教练提倡做慷慨之事而不求任何回报。"),
 '42': ("More and more evidence shows it makes us mentally and physically healthier to routinely count our blessings.", "越来越多的证据表明，经常细数自己的幸运会让我们身心更健康。"),
 '43': ("Of all states of mind, feeling grateful is considered one of the most healthy and beneficial.", "在所有心态中，感恩被认为是最健康、最有益的心态之一。"),
 '44': ("The principles underlying the research into gratitude are nothing new at all.", "关于感恩的研究所依据的原理一点也不新。"),
 '45': ("Gratitude is likely to enhance one's sense of being connected with other people.", "感恩可能会增强一个人与他人相联系的感觉。"),
}
L = [x[0] for x in P]; idx = {l: i for i, l in enumerate(L)}
B = {
 '36': dict(ans='C', loc=['C', 2], need='定位词：focus on · grateful · resentful（比较结构 far more…than）',
   why='题干的比较结构对应 C 段末句：it is far more helpful to focus on the things … for which we can express gratitude than those that incline us toward resentment and lamentation。does us far more good ↔ far more helpful；things we can be grateful for ↔ things for which we can express gratitude；sad and resentful ↔ resentment and lamentation。',
   trap='D 段也说关注值得感恩的事会更幸福，但它是分别描述两种关注带来的结果，没有“哪种更有益”的比较；题干的 far more…than 只在 C 段出现。',
   tip='题干里的比较结构（more…than、rather than）是强定位信号，原文通常保留同样的比较关系。'),
 '37': dict(ans='G', loc=['G', 4], need='定位词：beneficial impacts · extend · community · society',
   why='G 段先说感恩的人际良性循环，再说 a community in which people feel grateful … is a more pleasant place，接着 The beneficial effects of gratitude may extend even further，最后落到 bringing more goodness into the world around them。beneficial impacts ↔ beneficial effects；extend ↔ extend even further；从个人到社区再到更大的世界，层层递进。',
   trap='H 段讲的是人与人之间的联系感，停留在个人关系层面，没有扩展到社区和社会。',
   tip='题干出现原文原词（beneficial、extend）时，还要核对范围是否一致：individuals → community → wider society 的递进只有 G 段完整。'),
 '38': dict(ans='A', loc=['A', 1], need='定位词：participants · recent study · underestimated · thank-you notes',
   why='A 段第二句：One recent study asked participants to write a note of thanks … then estimate how surprised and happy the recipient would feel — an impact that they consistently underestimated。repeatedly ↔ consistently；the positive effect on those who received ↔ how surprised and happy the recipient would feel。',
   trap='A 段第二个研究讲写感谢信对写信人自己健康的好处，题干说的是对收信人的影响，对应的是第一个研究。两句在同一段，不影响选段，但要读准。',
   tip='研究、参与者、数字这类细节信息通常集中在文章开头，先扫开头几段。'),
 '39': dict(ans='I', loc=['I', 0], need='定位词：good deeds · uncomfortable',
   why='I 段首句：Of course, acts of kindness can also foster discomfort。good deeds ↔ acts of kindness；make people feel uncomfortable ↔ foster discomfort。',
   trap='I 段后半讲 entitlement（理所应得感），和题干无关，定位在首句即可。',
   tip='段首句常是主题句。段落匹配先读每段首句，往往能直接定位一半以上的题目。'),
 '40': dict(ans='F', loc=['F', 3], need='定位词：regularly · benefit · moral',
   why='F 段：Individuals who regularly engage in gratitude exercises … And the benefits are not only psychological and physical. They may also be moral。people who regularly express gratitude ↔ individuals who regularly engage in gratitude exercises / those who practice gratitude；benefit in moral terms ↔ the benefits … may also be moral。',
   trap='I 段末尾也出现 moral credit，但讲的是把善行当作理所应得，与“在道德上受益”无关。',
   tip='同一个词（moral）在多段出现时，比较整句的意思，不要只看词。'),
 '41': dict(ans='K', loc=['K', 2], need='定位词：basketball coach · generous acts · in return',
   why='K 段：the great basketball coach John Wooden … sought to promote purely generous acts, as opposed to those performed with an expectation of reward。advocated ↔ sought to promote；without expecting anything in return ↔ as opposed to those performed with an expectation of reward。',
   trap='K 段第二条忠告是每天感恩，与题干无关；题干对应第一条忠告及其解释。',
   tip='人名、职业（basketball coach）这类专名最容易定位，先做这类题，减少后面的候选段。'),
 '42': dict(ans='D', loc=['D', 2], need='定位词：more and more evidence · count our blessings · mentally and physically',
   why='D 段末句：there is mounting evidence that counting our blessings is one of the best habits we can develop to promote mental and physical health。more and more evidence ↔ mounting evidence；routinely ↔ habits；mentally and physically healthier ↔ promote mental and physical health。',
   trap='F 段也提到 counting their blessings 和 physical illness，但没有“越来越多的证据”，也没有身心健康并提；mounting evidence 只在 D 段。',
   tip='抓住题干里最独特的表达（more and more evidence）去找同义替换，不要追逐全文反复出现的词（blessings、gratitude）。'),
 '43': dict(ans='M', loc=['M', 2], need='定位词：of all states of mind · most healthy',
   why='M 段末句：Gratitude is one of the healthiest and most nourishing of all states of mind。of all states of mind 原词复现；one of the most healthy and beneficial ↔ one of the healthiest and most nourishing。',
   trap='其他段落讲的是感恩的具体好处，没有“所有心态中最……之一”这种总体评价。',
   tip='“最高级 + one of”这类总体评价常出现在文章最后一段的总结句里。'),
 '44': dict(ans='B', loc=['B', 0], need='定位词：principles · research into gratitude · nothing new',
   why='B 段首句：While this research into gratitude is relatively new, the principles involved are anything but (new)。the principles underlying the research ↔ the principles involved；nothing new at all ↔ anything but（绝不是新的）。',
   trap='E 段说感恩在文化传统中由来已久，但没有提到研究背后的 principles。',
   tip='anything but = 绝不是，是六级高频反义表达。要补出它省略的部分：anything but new。'),
 '45': dict(ans='H', loc=['H', 0], need='定位词：enhance · sense of being connected',
   why='H 段首句：Gratitude also tends to strengthen a sense of connection with others。enhance ↔ strengthen；sense of being connected with other people ↔ sense of connection with others。',
   trap='G 段讲社区整体更宜居，属于群体层面；题干是个人与他人的联系感。',
   tip='段首主题句 + 动词同义替换（enhance ↔ strengthen）是段落匹配最常见的考法。'),
}
blanks = {}
for n, b in B.items():
    blanks[n] = dict(ans=b['ans'], need=b['need'], cands=[], why=b['why'], trap=b['trap'], tip=b['tip'], loc=[idx[b['loc'][0]], b['loc'][1]])
options = {}
for l, sents in P:
    words = sents[0][0].split()
    options[l] = dict(w=l, pos='段落', zh=sents[0][1][:18] + ('…' if len(sents[0][1]) > 18 else ''), en=' '.join(words[:7]) + ('…' if len(words) > 7 else ''))
art = dict(
  id='gratitude-lifesaving', type='match',
  title='The Lifesaving Power of Gratitude', zh='感恩的救命力量',
  source='CET-6 · Part III Reading · Section B 段落匹配（集训刷题卷）',
  createdAt=1791612000000,
  paragraphs=[dict(label=l, sentences=[dict(en=e, zh=z) for e, z in s]) for l, s in P],
  items={n: dict(en=e, zh=z) for n, (e, z) in ITEMS.items()},
  options=options, blanks=blanks,
)
with open(os.path.join(ROOT, 'seeds', 'seed-gratitude.base.json'), 'w', encoding='utf-8') as f:
    json.dump(art, f, ensure_ascii=False, indent=1)
toks = set()
for l, s in P:
    for e, z in s:
        for t in re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)*", e): toks.add(t.lower())
print(len(toks))

# ---- step 2: merge glosses, key phrases and tips
ns = {}
exec(open(os.path.join(ROOT, 'tools', 'lex_gratitude.py'), encoding='utf-8').read(), ns)
missing = sorted(t for t in toks if t not in ns['LEX'])
if missing: print('no gloss for:', ' '.join(missing))
art = {**art, 'lex': ns['LEX'], 'keys': ns['KEYS'], 'tips': ns['TIPS']}
with open(os.path.join(ROOT, 'seeds', 'seed-gratitude.json'), 'w', encoding='utf-8') as f:
    json.dump(art, f, ensure_ascii=False, indent=1)
print('wrote seeds/seed-gratitude.json')
