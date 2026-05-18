-- Sichuan cuisine basics: core techniques + classic dishes
-- Techniques are prerequisites; dishes reference them via recipe_prerequisites.

DO $$
DECLARE
  -- technique IDs
  id_guoyou        uuid := gen_random_uuid();
  id_gouqian       uuid := gen_random_uuid();
  id_baochao       uuid := gen_random_uuid();
  id_chaoshui      uuid := gen_random_uuid();
  id_hongshao      uuid := gen_random_uuid();
  id_doubanjiang   uuid := gen_random_uuid();
  -- dish IDs
  id_mapo          uuid := gen_random_uuid();
  id_gongbao       uuid := gen_random_uuid();
  id_huiguo        uuid := gen_random_uuid();
  id_yuxiang       uuid := gen_random_uuid();
  id_shuizhuyu     uuid := gen_random_uuid();
  id_fuqi          uuid := gen_random_uuid();
BEGIN

-- ────────────────────────────────────────────────────────────
-- 基本功 Techniques (category = '川菜基本功', published = true)
-- ────────────────────────────────────────────────────────────

INSERT INTO recipes (
  id, slug, title, description, category, version,
  prep_time_minutes, cook_time_minutes, servings,
  flavor_sour, flavor_sweet, flavor_bitter, flavor_spicy, flavor_umami, flavor_aromatic,
  proficiency, tags, suitable_occasions,
  failure_notes, life_notes,
  ingredients, steps,
  published, sort_order, recommendation_rating
) VALUES

-- 1. 过油
(
  id_guoyou,
  'technique-guoyou',
  '过油（滑油 / 走油）',
  '将原料在温油中短暂预处理，使肉片嫩滑、不粘连，是川菜爆炒前的关键预处理步骤。',
  '川菜基本功', '1.0',
  5, 5, NULL,
  0, 0, 0, 0, 2, 3,
  2,
  ARRAY['基本功','过油','滑油','预处理'],
  ARRAY['日常'],
  '油温过高肉质变老；油温过低上浆脱落。用手背感受油温，或丢入小葱段，边缘冒小泡即为三四成油温（约120°C）。',
  '掌握过油后，炒牛肉、炒鸡丁都会明显嫩很多。',
  '[
    {"id":"i1","amount":"300","unit":"g","name":"猪里脊或鸡胸肉"},
    {"id":"i2","amount":"1","unit":"个","name":"蛋清"},
    {"id":"i3","amount":"1","unit":"大勺","name":"淀粉"},
    {"id":"i4","amount":"1","unit":"小勺","name":"盐"},
    {"id":"i5","amount":"适量","unit":"","name":"食用油（宽油）"}
  ]'::jsonb,
  '[
    {"id":"s1","order":1,"title":"腌制上浆","description":"肉切薄片或丝，加盐、蛋清、淀粉抓匀，静置10分钟。","tip":"淀粉用量宁少勿多，薄薄一层即可"},
    {"id":"s2","order":2,"title":"控制油温","description":"锅入宽油，中小火加热至三成热（约100-120°C）。判断方式：筷子插入油中，边缘冒细小泡泡。"},
    {"id":"s3","order":3,"title":"滑油","description":"将肉片分散下入油中，用筷子轻轻拨散，待变色后立刻捞出控油。","tip":"全程不超过30秒，宁早捞勿晚"}
  ]'::jsonb,
  true, 10, 4
),

-- 2. 勾芡
(
  id_gouqian,
  'technique-gouqian',
  '勾芡',
  '用水淀粉在出锅前收汁，使汤汁包裹食材，是川菜呈现"亮汁亮芡"质感的核心技法。',
  '川菜基本功', '1.0',
  2, 3, NULL,
  0, 0, 0, 0, 1, 1,
  1,
  ARRAY['基本功','勾芡','水淀粉','收汁'],
  ARRAY['日常'],
  '水淀粉比例：淀粉:水 ≈ 1:2。芡汁要提前调好，临出锅沿锅边淋入。锅温不够时下芡会结块；火太大下芡则立刻凝固无法裹匀。',
  '勾芡的量感需要反复练习。宁淡勿浓，可以补，收过了就没法救。',
  '[
    {"id":"i1","amount":"1","unit":"大勺","name":"玉米淀粉或土豆淀粉"},
    {"id":"i2","amount":"2","unit":"大勺","name":"清水"}
  ]'::jsonb,
  '[
    {"id":"s1","order":1,"title":"调水淀粉","description":"淀粉加水调匀，静置备用（使用前再搅一次，防沉淀）。"},
    {"id":"s2","order":2,"title":"判断时机","description":"菜肴出锅前30秒，转大火收汁至八成干。","tip":"汤汁过多时要先收汁，否则芡汁被稀释"},
    {"id":"s3","order":3,"title":"淋入芡汁","description":"沿锅边转圈淋入水淀粉，同时快速翻炒均匀，见汤汁变透明浓稠后立刻出锅。"}
  ]'::jsonb,
  true, 11, 4
),

-- 3. 爆炒
(
  id_baochao,
  'technique-baochao',
  '爆炒（大火快炒）',
  '川菜的灵魂手法：猛火、热锅、快速翻炒，在极短时间内完成加热，保留食材脆嫩口感并产生锅气。',
  '川菜基本功', '1.0',
  5, 5, NULL,
  0, 0, 0, 1, 2, 4,
  2,
  ARRAY['基本功','爆炒','大火','锅气'],
  ARRAY['日常'],
  '家用灶火力不足是常见问题。解决办法：每次炒菜量不超过两人份；锅要烧到冒烟再下油；食材提前沥干水分。',
  '真正的锅气来自高温短时。与其用小火慢炒求保险，不如接受偶尔炒糊的风险来练习大火。',
  '[
    {"id":"i1","amount":"适量","unit":"","name":"食材（肉/蔬菜）"},
    {"id":"i2","amount":"2","unit":"大勺","name":"食用油"},
    {"id":"i3","amount":"适量","unit":"","name":"调味料（盐/酱油/料酒）"}
  ]'::jsonb,
  '[
    {"id":"s1","order":1,"title":"热锅","description":"铁锅置大火上，烧至锅面开始冒青烟（约200°C以上）。","tip":"锅不够热是锅气不足的头号原因"},
    {"id":"s2","order":2,"title":"滑锅下油","description":"沿锅壁转圈倒入油，立即下食材。"},
    {"id":"s3","order":3,"title":"快速翻炒","description":"持续大火，用锅铲或颠锅快速翻炒，全程不超过2分钟。","tip":"调味料要提前调好在碗里，炒时一次性下入"},
    {"id":"s4","order":4,"title":"出锅","description":"见食材断生、香气出来后立即出锅，不要等到完全熟透再关火。"}
  ]'::jsonb,
  true, 12, 5
),

-- 4. 焯水
(
  id_chaoshui,
  'technique-chaoshui',
  '焯水（汆水）',
  '将原料放入沸水中短暂加热，去除血水、腥味、草酸，或定型、预熟，是川菜荤素处理的基础步骤。',
  '川菜基本功', '1.0',
  3, 5, NULL,
  0, 0, 0, 0, 1, 1,
  1,
  ARRAY['基本功','焯水','去腥','预处理'],
  ARRAY['日常'],
  '肉类冷水下锅，随水温升高慢慢逼出血沫；蔬菜必须沸水下锅，否则叶绿素流失变黄。焯水后立刻过冰水可保持蔬菜翠绿脆嫩。',
  '焯水的水要足够多，食材下锅后水温不能明显降低，否则达不到目的。',
  '[
    {"id":"i1","amount":"适量","unit":"","name":"待处理食材"},
    {"id":"i2","amount":"适量","unit":"","name":"清水"},
    {"id":"i3","amount":"1","unit":"小勺","name":"盐（蔬菜用）"},
    {"id":"i4","amount":"2","unit":"片","name":"姜片（肉类用）"},
    {"id":"i5","amount":"1","unit":"大勺","name":"料酒（肉类用）"}
  ]'::jsonb,
  '[
    {"id":"s1","order":1,"title":"肉类焯水","description":"冷水下锅，加姜片、料酒，大火烧开，撇去浮沫，捞出冲洗干净。","tip":"猪肉焯2-3分钟，鸡肉焯3-4分钟"},
    {"id":"s2","order":2,"title":"蔬菜焯水","description":"大量水烧开，加盐和几滴油，蔬菜下锅，30秒-1分钟捞出，立刻放入冰水中。","tip":"豆芽、菠菜30秒；西蓝花、芹菜1分钟"}
  ]'::jsonb,
  true, 13, 4
),

-- 5. 红烧技法
(
  id_hongshao,
  'technique-hongshao',
  '红烧',
  '先煎或过油上色，再加酱油、糖、料酒等调料加水慢炖收汁，使食材入味且色泽红亮，是川菜家常核心技法之一。',
  '川菜基本功', '1.0',
  10, 40, NULL,
  0, 2, 0, 1, 3, 3,
  2,
  ARRAY['基本功','红烧','收汁','炖煮'],
  ARRAY['日常','家宴'],
  '糖色（炒糖）是关键：冰糖小火慢炒至琥珀色后下肉翻炒上色，颜色漂亮且不苦；用老抽代替会导致颜色发黑且味道差。收汁时保持中火，不断翻炒防止粘锅糊底。',
  '红烧最考验耐心，全程约40分钟。第一次做不要缩短时间，充分炖透的口感完全不同。',
  '[
    {"id":"i1","amount":"500","unit":"g","name":"猪五花或猪蹄"},
    {"id":"i2","amount":"30","unit":"g","name":"冰糖"},
    {"id":"i3","amount":"2","unit":"大勺","name":"生抽"},
    {"id":"i4","amount":"1","unit":"大勺","name":"老抽"},
    {"id":"i5","amount":"2","unit":"大勺","name":"料酒"},
    {"id":"i6","amount":"3","unit":"片","name":"姜"},
    {"id":"i7","amount":"2","unit":"根","name":"葱"}
  ]'::jsonb,
  '[
    {"id":"s1","order":1,"title":"焯水去腥","description":"猪肉冷水下锅，加姜、料酒焯水，去浮沫后捞出备用。"},
    {"id":"s2","order":2,"title":"炒糖色","description":"锅入少量油，放冰糖小火慢炒，待糖完全融化变为琥珀色时立即下肉翻炒上色。","tip":"糖色宁浅勿深，颜色继续深化，过了就苦"},
    {"id":"s3","order":3,"title":"加调料炖煮","description":"加入生抽、老抽、料酒、姜葱，注入热水没过食材，大火烧开转小火炖30分钟。"},
    {"id":"s4","order":4,"title":"收汁","description":"转中大火，收至汤汁浓稠包裹食材，出锅前尝味补盐。","tip":"收汁时要不断翻动防止糊底"}
  ]'::jsonb,
  true, 14, 5
),

-- 6. 郫县豆瓣酱炒法
(
  id_doubanjiang,
  'technique-doubanjiang',
  '郫县豆瓣酱炒制法',
  '川菜的灵魂调料郫县豆瓣酱必须经过充分煸炒才能出色出香，是回锅肉、麻婆豆腐等菜肴风味的根基。',
  '川菜基本功', '1.0',
  2, 5, NULL,
  0, 0, 0, 3, 3, 4,
  2,
  ARRAY['基本功','豆瓣酱','郫县','炒香'],
  ARRAY['日常'],
  '豆瓣酱一定要剁细再下锅，否则整块不出味。煸炒时间不足则腥味重、色泽不红亮；煸过了则发苦。见红油析出、香气扑鼻是完成信号。',
  '郫县豆瓣酱本身已有咸味，用了豆瓣的菜肴要最后再尝味补盐，不要一开始就加盐。',
  '[
    {"id":"i1","amount":"2","unit":"大勺","name":"郫县豆瓣酱（剁细）"},
    {"id":"i2","amount":"2","unit":"大勺","name":"食用油"},
    {"id":"i3","amount":"3","unit":"片","name":"姜"},
    {"id":"i4","amount":"2","unit":"瓣","name":"蒜"}
  ]'::jsonb,
  '[
    {"id":"s1","order":1,"title":"备料","description":"郫县豆瓣酱用刀剁细，姜蒜切末备用。"},
    {"id":"s2","order":2,"title":"煸炒豆瓣","description":"锅入油，中小火下豆瓣酱、姜末，持续翻炒2-3分钟。","tip":"不要用大火，豆瓣容易糊"},
    {"id":"s3","order":3,"title":"出红油","description":"见豆瓣酱颜色由暗红变鲜红、油变成红色、香气浓郁时，加入蒜末再炒30秒，即可下其他食材。"}
  ]'::jsonb,
  true, 15, 5
),

-- ────────────────────────────────────────────────────────────
-- 经典川菜 Classic Dishes (category = '川菜')
-- ────────────────────────────────────────────────────────────

-- 7. 麻婆豆腐
(
  id_mapo,
  'mapo-tofu',
  '麻婆豆腐',
  '麻辣鲜香，豆腐嫩滑，豆瓣红油包裹牛肉末，是最具代表性的川菜之一。"麻、辣、烫、香、嫩、鲜、酥"七字诀。',
  '川菜', '1.0',
  10, 15, 2,
  0, 0, 0, 4, 4, 3,
  2,
  ARRAY['豆腐','麻辣','豆瓣酱','家常川菜'],
  ARRAY['日常','下饭'],
  '豆腐易碎：焯水定型后轻推勿铲；收芡时推锅，不用锅铲翻炒。花椒粉最后撒，煮过的花椒香气损失大。',
  '豆腐选北豆腐（老豆腐）比嫩豆腐更容易操作，口感也更有层次。',
  '[
    {"id":"i1","amount":"400","unit":"g","name":"北豆腐"},
    {"id":"i2","amount":"100","unit":"g","name":"牛肉末"},
    {"id":"i3","amount":"2","unit":"大勺","name":"郫县豆瓣酱（剁细）"},
    {"id":"i4","amount":"1","unit":"大勺","name":"豆豉（剁细）"},
    {"id":"i5","amount":"3","unit":"瓣","name":"蒜（切末）"},
    {"id":"i6","amount":"1","unit":"小勺","name":"姜末"},
    {"id":"i7","amount":"1","unit":"碗","name":"高汤或清水"},
    {"id":"i8","amount":"1","unit":"大勺","name":"生抽"},
    {"id":"i9","amount":"1","unit":"小勺","name":"花椒粉"},
    {"id":"i10","amount":"2","unit":"根","name":"葱花"},
    {"id":"i11","amount":"1.5","unit":"大勺","name":"水淀粉"}
  ]'::jsonb,
  '[
    {"id":"s1","order":1,"title":"豆腐焯水","description":"豆腐切2cm方块，加盐沸水焯2分钟定型，捞出备用。"},
    {"id":"s2","order":2,"title":"炒牛肉末","description":"锅入油，中火下牛肉末炒散，炒至变色出香后拨到锅边。"},
    {"id":"s3","order":3,"title":"炒豆瓣","description":"利用锅中余油，下豆瓣酱、豆豉、姜蒜末，中小火煸炒出红油（约2分钟）。"},
    {"id":"s4","order":4,"title":"加汤煮豆腐","description":"下高汤，放入豆腐，加生抽，中火煮3分钟入味。","tip":"用勺子轻推豆腐，不要用铲子翻炒"},
    {"id":"s5","order":5,"title":"勾芡出锅","description":"分两次淋入水淀粉，轻推收汁，出锅撒葱花和花椒粉。","tip":"分两次勾芡，浓度更好控制"}
  ]'::jsonb,
  true, 20, 5
),

-- 8. 宫保鸡丁
(
  id_gongbao,
  'gongbao-chicken',
  '宫保鸡丁',
  '荔枝口味型，酸甜微辣，鸡丁滑嫩，花生酥脆。糊辣荔枝味是关键——辣椒炸糊出香而非炸焦出苦。',
  '川菜', '1.0',
  20, 10, 2,
  2, 3, 0, 2, 3, 4,
  3,
  ARRAY['鸡丁','荔枝味','花生','宫保'],
  ARRAY['日常','宴客'],
  '荔枝口：糖略多于醋，酸甜比约1:0.8。干辣椒要炸糊（深棕色）而不是炸黑，炸黑则发苦。调味汁提前兑好，入锅后动作要快。',
  '炸花生要提前做：冷油下锅小火慢炸，出锅后会继续变脆，不要等锅里就很脆了再捞。',
  '[
    {"id":"i1","amount":"300","unit":"g","name":"鸡胸肉"},
    {"id":"i2","amount":"80","unit":"g","name":"油炸花生米"},
    {"id":"i3","amount":"6","unit":"根","name":"干辣椒"},
    {"id":"i4","amount":"1","unit":"小勺","name":"花椒"},
    {"id":"i5","amount":"1","unit":"个","name":"蛋清"},
    {"id":"i6","amount":"1","unit":"大勺","name":"淀粉"},
    {"id":"i7","amount":"1","unit":"小勺","name":"盐（腌制用）"},
    {"id":"i8","amount":"1.5","unit":"大勺","name":"生抽"},
    {"id":"i9","amount":"1","unit":"大勺","name":"米醋"},
    {"id":"i10","amount":"1.5","unit":"大勺","name":"糖"},
    {"id":"i11","amount":"1","unit":"小勺","name":"淀粉（调汁用）"},
    {"id":"i12","amount":"3","unit":"瓣","name":"蒜"},
    {"id":"i13","amount":"1","unit":"段","name":"葱白"}
  ]'::jsonb,
  '[
    {"id":"s1","order":1,"title":"腌制鸡丁","description":"鸡胸切1.5cm丁，加盐、蛋清、淀粉抓匀，腌15分钟。"},
    {"id":"s2","order":2,"title":"调荔枝汁","description":"碗中混合生抽、米醋、糖、淀粉、少量水，比例约酱油:醋:糖 = 1.5:1:1.5。"},
    {"id":"s3","order":3,"title":"过油滑鸡丁","description":"油温三成热，鸡丁下锅滑散至变色，立刻捞出。"},
    {"id":"s4","order":4,"title":"炸辣椒花椒","description":"锅留底油，下干辣椒、花椒，小火炸至辣椒变深棕色出香（约30秒）。","tip":"辣椒颜色是关键，深棕色而非黑色"},
    {"id":"s5","order":5,"title":"爆炒合并","description":"下葱蒜爆香，放入鸡丁翻炒均匀，淋入调好的荔枝汁，大火翻炒收汁。"},
    {"id":"s6","order":6,"title":"加花生出锅","description":"汁水收浓后关火，加入花生米翻拌出锅（花生不要炒，只拌）。","tip":"花生最后放，保持酥脆"}
  ]'::jsonb,
  true, 21, 5
),

-- 9. 回锅肉
(
  id_huiguo,
  'huiguo-pork',
  '回锅肉',
  '先煮后炒的二次烹饪技法，五花肉切片后炒出灯盏形，加郫县豆瓣、甜面酱，是最具川味家常气息的一道菜。',
  '川菜', '1.0',
  10, 15, 2,
  0, 1, 0, 3, 3, 4,
  2,
  ARRAY['五花肉','豆瓣酱','家常川菜','灯盏形'],
  ARRAY['日常','下饭'],
  '肉要煮到筷子能插透但仍有阻力（约20分钟），太生不好切，太烂炒时散形。切片后冷藏30分钟再炒，更容易炒出灯盏形（片边卷起）。炒肉时不用加油，靠肉自身出油。',
  '回锅肉用的青蒜苗（蒜苗）不是大蒜，是带绿叶的蒜苗，这个买错了就不对味了。',
  '[
    {"id":"i1","amount":"400","unit":"g","name":"带皮猪五花肉"},
    {"id":"i2","amount":"2","unit":"根","name":"蒜苗（青蒜苗）"},
    {"id":"i3","amount":"2","unit":"大勺","name":"郫县豆瓣酱（剁细）"},
    {"id":"i4","amount":"1","unit":"大勺","name":"甜面酱"},
    {"id":"i5","amount":"1","unit":"小勺","name":"生抽"},
    {"id":"i6","amount":"1","unit":"小勺","name":"糖"},
    {"id":"i7","amount":"3","unit":"片","name":"姜"},
    {"id":"i8","amount":"1","unit":"大勺","name":"料酒"}
  ]'::jsonb,
  '[
    {"id":"s1","order":1,"title":"整块煮肉","description":"五花肉整块冷水下锅，加姜、料酒，煮约20分钟至筷子可插入，捞出晾凉。","tip":"煮好后放冰箱冷藏30分钟，切片不散形"},
    {"id":"s2","order":2,"title":"切片","description":"晾凉的五花肉切3mm薄片。蒜苗斜切段，白绿分开备用。"},
    {"id":"s3","order":3,"title":"炒出灯盏形","description":"不放油，冷锅下肉片，中火加热，肉片自身出油，炒至边缘卷起呈灯盏形、表面微焦。","tip":"全程不加油，等肉片自己渗出猪油"},
    {"id":"s4","order":4,"title":"炒豆瓣上色","description":"肉片拨到锅边，下郫县豆瓣、甜面酱，小火煸炒出红油，与肉片混合翻炒。"},
    {"id":"s5","order":5,"title":"加蒜苗出锅","description":"加生抽、糖调味，先下蒜苗白色部分翻炒30秒，再下绿色部分，大火翻炒均匀出锅。"}
  ]'::jsonb,
  true, 22, 5
),

-- 10. 鱼香肉丝
(
  id_yuxiang,
  'yuxiang-pork',
  '鱼香肉丝',
  '无鱼却有鱼香——四川泡辣椒赋予酸辣鲜甜的复合味型。肉丝滑嫩，木耳和笋丝脆爽，是川菜家常名菜。',
  '川菜', '1.0',
  20, 10, 2,
  2, 2, 0, 2, 3, 4,
  3,
  ARRAY['肉丝','鱼香味型','泡椒','木耳'],
  ARRAY['日常','下饭'],
  '鱼香味型必须用泡辣椒（不是新鲜辣椒），泡辣椒的酸是发酵酸，与醋酸不同，少了就不对。糖醋比约1:1，先酸后甜是正确顺序。肉丝要提前冷冻15分钟再切，更容易切细。',
  '泡辣椒是这道菜最难买到的食材，可在网上购买四川泡辣椒（不是朝天椒）。',
  '[
    {"id":"i1","amount":"250","unit":"g","name":"猪里脊"},
    {"id":"i2","amount":"3","unit":"根","name":"泡辣椒"},
    {"id":"i3","amount":"50","unit":"g","name":"水发木耳"},
    {"id":"i4","amount":"50","unit":"g","name":"冬笋或莴笋"},
    {"id":"i5","amount":"1","unit":"个","name":"蛋清"},
    {"id":"i6","amount":"1","unit":"大勺","name":"淀粉"},
    {"id":"i7","amount":"3","unit":"瓣","name":"蒜"},
    {"id":"i8","amount":"1","unit":"段","name":"姜"},
    {"id":"i9","amount":"1","unit":"大勺","name":"生抽"},
    {"id":"i10","amount":"1","unit":"大勺","name":"米醋"},
    {"id":"i11","amount":"1","unit":"大勺","name":"糖"},
    {"id":"i12","amount":"1","unit":"小勺","name":"淀粉（调汁用）"}
  ]'::jsonb,
  '[
    {"id":"s1","order":1,"title":"腌制肉丝","description":"猪里脊切细丝（筷子粗细），加蛋清、淀粉、少量盐抓匀腌10分钟。"},
    {"id":"s2","order":2,"title":"调鱼香汁","description":"碗中调入生抽、米醋、糖、水淀粉（比例1:1:1），搅匀备用。"},
    {"id":"s3","order":3,"title":"处理配菜","description":"木耳、笋切细丝，泡辣椒切碎，姜蒜切末。"},
    {"id":"s4","order":4,"title":"滑肉丝","description":"油三成热，肉丝下锅滑散变色后立刻捞出。"},
    {"id":"s5","order":5,"title":"炒泡椒出香","description":"锅留底油，下泡辣椒碎、姜蒜末，中小火炒出红油香气（约1分钟）。"},
    {"id":"s6","order":6,"title":"合炒收汁","description":"下木耳、笋丝翻炒30秒，放入肉丝，淋鱼香汁，大火翻炒均匀收汁出锅。","tip":"汁下锅后动作要快，全程约15秒"}
  ]'::jsonb,
  true, 23, 5
),

-- 11. 水煮鱼
(
  id_shuizhuyu,
  'shuizhu-fish',
  '水煮鱼',
  '麻辣鲜香，鱼片嫩滑。以郫县豆瓣和大量辣椒花椒打底，热油激发最终香气是点睛之笔。',
  '川菜', '1.0',
  25, 20, 3,
  0, 0, 0, 5, 4, 4,
  3,
  ARRAY['鱼','麻辣','水煮','热油激香'],
  ARRAY['日常','宴客'],
  '鱼片腌制时加少量食用碱（小苏打）可使鱼片更嫩滑，但不要超过0.5g/500g。最后浇热油一定要足够热（冒烟），温油激不出香气。辣椒和花椒的量要大胆，不够就不够味。',
  '水煮鱼的"水煮"是指在汤里煮，不是白水煮，汤底要先做好。',
  '[
    {"id":"i1","amount":"500","unit":"g","name":"草鱼或黑鱼（片成薄片）"},
    {"id":"i2","amount":"200","unit":"g","name":"豆芽"},
    {"id":"i3","amount":"3","unit":"大勺","name":"郫县豆瓣酱"},
    {"id":"i4","amount":"20","unit":"根","name":"干辣椒"},
    {"id":"i5","amount":"1","unit":"大勺","name":"花椒"},
    {"id":"i6","amount":"1","unit":"个","name":"蛋清"},
    {"id":"i7","amount":"1.5","unit":"大勺","name":"淀粉"},
    {"id":"i8","amount":"1","unit":"小勺","name":"盐"},
    {"id":"i9","amount":"4","unit":"瓣","name":"蒜"},
    {"id":"i10","amount":"3","unit":"片","name":"姜"},
    {"id":"i11","amount":"500","unit":"ml","name":"高汤或鸡汤"},
    {"id":"i12","amount":"4","unit":"大勺","name":"食用油（浇油用）"}
  ]'::jsonb,
  '[
    {"id":"s1","order":1,"title":"腌制鱼片","description":"鱼片加盐、蛋清、淀粉抓匀，腌15分钟。"},
    {"id":"s2","order":2,"title":"煮豆芽垫底","description":"豆芽沸水焯熟，铺在碗底备用。"},
    {"id":"s3","order":3,"title":"炒豆瓣底汤","description":"锅入油，炒香豆瓣酱、姜蒜，加高汤烧开，调味，过滤汤汁。","tip":"汤底可提前做，更入味"},
    {"id":"s4","order":4,"title":"煮鱼片","description":"汤底大火烧开，鱼片一片片展开下入，约1分钟变白断生后捞出铺在豆芽上，倒入汤汁。"},
    {"id":"s5","order":5,"title":"铺辣椒花椒","description":"在鱼片上铺满干辣椒段和花椒。"},
    {"id":"s6","order":6,"title":"热油激香","description":"另起锅将油烧至冒烟（约200°C），沿碗边浇在辣椒花椒上，听到滋啦声即成。","tip":"油一定要烧到冒烟，这步是整道菜香气的来源"}
  ]'::jsonb,
  true, 24, 5
),

-- 12. 夫妻肺片
(
  id_fuqi,
  'fuqi-feipian',
  '夫妻肺片',
  '凉拌牛肉类川菜，红油麻辣，牛肉片和牛杂薄而入味，是成都街头最经典的凉菜之一。',
  '川菜', '1.0',
  15, 60, 3,
  1, 0, 0, 3, 4, 4,
  2,
  ARRAY['牛肉','凉拌','红油','麻辣'],
  ARRAY['日常','下酒','宴客'],
  '牛肉和牛杂要卤得够烂但不散，卤水材料要足。红油是味型关键，买现成红油也可以但香气有差距。切片要薄（约2mm），越薄越入味。',
  '没有牛杂时单用牛腱子也很好，加一些牛肚口感更丰富。',
  '[
    {"id":"i1","amount":"300","unit":"g","name":"牛腱子"},
    {"id":"i2","amount":"200","unit":"g","name":"牛肚（可选）"},
    {"id":"i3","amount":"3","unit":"大勺","name":"红油"},
    {"id":"i4","amount":"1","unit":"大勺","name":"花椒油"},
    {"id":"i5","amount":"2","unit":"大勺","name":"生抽"},
    {"id":"i6","amount":"1","unit":"小勺","name":"糖"},
    {"id":"i7","amount":"2","unit":"瓣","name":"蒜（压泥）"},
    {"id":"i8","amount":"适量","unit":"","name":"卤水（八角、桂皮、香叶、姜、料酒、生抽）"},
    {"id":"i9","amount":"适量","unit":"","name":"芹菜或葱花"},
    {"id":"i10","amount":"适量","unit":"","name":"花生碎或芝麻"}
  ]'::jsonb,
  '[
    {"id":"s1","order":1,"title":"卤牛肉","description":"牛腱子冷水焯水去血沫，与卤料一起小火卤约1.5小时，至筷子轻松穿透。关火泡至自然冷却更入味。"},
    {"id":"s2","order":2,"title":"切片","description":"卤好的牛肉逆纹切薄片（约2mm），牛肚切条备用。"},
    {"id":"s3","order":3,"title":"调红油味汁","description":"碗中调入红油、花椒油、生抽、糖、蒜泥，尝味调整咸淡辣度。"},
    {"id":"s4","order":4,"title":"拌制","description":"牛肉片、牛肚加味汁拌匀，装盘后撒花生碎、芹菜段、芝麻即可。","tip":"可提前半小时拌好，更入味"}
  ]'::jsonb,
  true, 25, 5
);

-- ────────────────────────────────────────────────────────────
-- 前置技能关联 recipe_prerequisites
-- ────────────────────────────────────────────────────────────

INSERT INTO recipe_prerequisites (id, from_recipe_id, to_recipe_id, skill_label) VALUES
  -- 麻婆豆腐 需要：焯水、勾芡、郫县豆瓣炒法
  (gen_random_uuid(), id_chaoshui,    id_mapo,    '豆腐焯水定型'),
  (gen_random_uuid(), id_gouqian,     id_mapo,    '勾芡收汁'),
  (gen_random_uuid(), id_doubanjiang, id_mapo,    '郫县豆瓣炒香出红油'),

  -- 宫保鸡丁 需要：过油、爆炒
  (gen_random_uuid(), id_guoyou,   id_gongbao,  '鸡丁过油滑嫩'),
  (gen_random_uuid(), id_baochao,  id_gongbao,  '大火快炒锅气'),

  -- 回锅肉 需要：郫县豆瓣炒法
  (gen_random_uuid(), id_doubanjiang, id_huiguo, '豆瓣上色出香'),

  -- 鱼香肉丝 需要：过油、勾芡、爆炒
  (gen_random_uuid(), id_guoyou,  id_yuxiang,  '肉丝过油滑嫩'),
  (gen_random_uuid(), id_gouqian, id_yuxiang,  '鱼香汁勾芡'),
  (gen_random_uuid(), id_baochao, id_yuxiang,  '大火快炒'),

  -- 水煮鱼 需要：焯水、郫县豆瓣炒法
  (gen_random_uuid(), id_chaoshui,    id_shuizhuyu, '豆芽焯水'),
  (gen_random_uuid(), id_doubanjiang, id_shuizhuyu, '豆瓣炒汤底'),

  -- 夫妻肺片 需要：焯水
  (gen_random_uuid(), id_chaoshui, id_fuqi, '牛肉焯水去腥');

END $$;
