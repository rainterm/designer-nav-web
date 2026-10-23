import { iconFromSiteUrl } from '@/utils/favicon'

export const STORAGE_KEY = 'nav-web.sites.v1'

const RAW_SITES = [
  {
    id: 'cat-llm',
    category: '大模型',
    letter: '大',
    items: [
      {
        id: 'deepseek',
        name: 'DeepSeek',
        desc: '深度求索对话模型',
        url: 'https://chat.deepseek.com/',
        icon: 'https://cdn.deepseek.com/chat/icon.png',
        letter: 'D'
      },
      {
        id: 'doubao',
        name: '豆包',
        desc: '字节跳动对话助手',
        url: 'https://www.doubao.com/chat/',
        letter: '豆'
      },
      {
        id: 'kimi',
        name: 'Kimi',
        desc: '月之暗面长上下文',
        url: 'https://www.kimi.com/',
        letter: 'K'
      },
      {
        id: 'tongyi',
        name: '通义千问',
        desc: '阿里云大模型',
        url: 'https://www.qianwen.com/',
        letter: '通'
      },
      {
        id: 'yuanbao',
        name: '腾讯元宝',
        desc: '腾讯混元助手',
        url: 'https://yuanbao.tencent.com/chat',
        letter: '元'
      },
      {
        id: 'chatglm',
        name: '智谱清言',
        desc: 'ChatGLM 对话',
        url: 'https://chatglm.cn/main/',
        letter: '智'
      },
      {
        id: 'xinghuo',
        name: '讯飞星火',
        desc: '科大讯飞认知大模型',
        url: 'https://xinghuo.xfyun.cn/desk',
        letter: '星'
      },
      {
        id: 'chatgpt',
        name: 'ChatGPT',
        desc: 'OpenAI 通用对话',
        url: 'https://chatgpt.com/',
        icon: 'https://icon.horse/icon/chatgpt.com',
        letter: 'G'
      },
      {
        id: 'gemini',
        name: 'Gemini',
        desc: 'Google 多模态助手',
        url: 'https://gemini.google.com/app',
        icon: 'https://icon.horse/icon/gemini.google.com',
        letter: 'Ge'
      }
    ]
  },
  {
    id: 'cat-media',
    category: '图像视频',
    letter: '影',
    items: [
      {
        id: 'jimeng',
        name: '即梦 AI',
        desc: '字节图像与视频生成',
        url: 'https://jimeng.jianying.com/ai-tool/generate',
        letter: '即'
      },
      {
        id: 'kling',
        name: '可灵 AI',
        desc: '快手视频生成',
        url: 'https://www.klingai.com/app',
        letter: '可'
      },
      {
        id: 'hailuo',
        name: '海螺 AI',
        desc: 'MiniMax 视频生成',
        url: 'https://hailuoai.com/create',
        letter: '海'
      },
      {
        id: 'wanxiang',
        name: '通义万相',
        desc: '阿里图像与视频生成',
        url: 'https://tongyi.aliyun.com/wan/explore',
        letter: '万'
      },
      {
        id: 'vidu',
        name: 'Vidu',
        desc: '生数科技视频生成',
        url: 'https://www.vidu.cn/create',
        letter: 'Vi'
      }
    ]
  },
  {
    id: 'cat-open',
    category: '开源',
    letter: '开',
    items: [
      {
        id: 'github',
        name: 'GitHub',
        desc: '全球最大开源代码托管平台',
        url: 'https://github.com/',
        letter: 'GH'
      },
      {
        id: 'gitee',
        name: 'Gitee',
        desc: '国内代码托管与开源社区',
        url: 'https://gitee.com/',
        letter: '码'
      },
      {
        id: 'huggingface',
        name: 'Hugging Face',
        desc: '开源模型与数据集社区',
        url: 'https://huggingface.co/models',
        letter: 'HF'
      },
      {
        id: 'modelscope',
        name: 'ModelScope',
        desc: '魔搭开源模型社区',
        url: 'https://www.modelscope.cn/models',
        letter: '魔'
      },
      {
        id: 'npm',
        name: 'npm',
        desc: 'JavaScript 包注册中心',
        url: 'https://www.npmjs.com/',
        letter: 'npm'
      },
      {
        id: 'pypi',
        name: 'PyPI',
        desc: 'Python 包索引',
        url: 'https://pypi.org/',
        letter: 'Py'
      },
      {
        id: 'dockerhub',
        name: 'Docker Hub',
        desc: '容器镜像仓库',
        url: 'https://hub.docker.com/',
        letter: 'Dk'
      },
      {
        id: 'ollama',
        name: 'Ollama',
        desc: '本地大模型运行',
        url: 'https://ollama.com/library',
        letter: 'O'
      }
    ]
  },
  {
    id: 'cat-recharge',
    category: '模型充值',
    letter: '充',
    items: [
      {
        id: 'recharge-deepseek',
        name: 'DeepSeek 开放平台',
        desc: '官方 API 充值与用量',
        url: 'https://platform.deepseek.com/top_up',
        icon: 'https://cdn.deepseek.com/chat/icon.png',
        letter: 'D'
      },
      {
        id: 'recharge-siliconflow',
        name: '硅基流动',
        desc: '多模型聚合充值与账单',
        url: 'https://cloud.siliconflow.cn/account/balance',
        letter: '硅'
      },
      {
        id: 'recharge-bailian',
        name: '阿里云百炼',
        desc: '通义模型充值与费用管理',
        url: 'https://bailian.console.aliyun.com/',
        letter: '百'
      },
      {
        id: 'recharge-ark',
        name: '火山方舟',
        desc: '豆包大模型充值管理',
        url: 'https://console.volcengine.com/ark',
        letter: '火'
      },
      {
        id: 'recharge-zhipu',
        name: '智谱开放平台',
        desc: 'GLM 充值与财务概览',
        url: 'https://open.bigmodel.cn/finance/overview',
        letter: '智'
      },
      {
        id: 'recharge-kimi',
        name: '月之暗面',
        desc: 'Kimi API 充值管理',
        url: 'https://platform.kimi.com/console/pay',
        letter: 'K'
      },
      {
        id: 'recharge-minimax',
        name: 'MiniMax',
        desc: '海螺模型充值记录',
        url: 'https://platform.minimax.cn/user-center/payment/balance',
        letter: 'M'
      },
      {
        id: 'recharge-hunyuan',
        name: '腾讯混元',
        desc: '混元大模型控制台',
        url: 'https://console.cloud.tencent.com/hunyuan',
        letter: '混'
      },
      {
        id: 'recharge-xfyun',
        name: '讯飞开放平台',
        desc: '星火大模型服务管理',
        url: 'https://console.xfyun.cn/services/cbm',
        letter: '讯'
      }
    ]
  },
  {
    id: 'cat-creator',
    category: '自媒体创作',
    letter: '媒',
    items: [
      {
        id: 'jianying',
        name: '剪映',
        desc: '视频剪辑与创作',
        url: 'https://www.jianying.com/',
        letter: '剪'
      },
      {
        id: 'canva',
        name: '可画 Canva',
        desc: '在线平面与视频设计',
        url: 'https://www.canva.cn/',
        letter: 'Ca'
      },
      {
        id: 'weixin-mp',
        name: '微信公众平台',
        desc: '公众号内容创作与管理',
        url: 'https://mp.weixin.qq.com/',
        letter: '公'
      },
      {
        id: 'bilibili-creator',
        name: '哔哩哔哩创作中心',
        desc: 'B 站投稿与数据',
        url: 'https://member.bilibili.com/',
        letter: 'B'
      },
      {
        id: 'douyin-creator',
        name: '抖音创作者中心',
        desc: '短视频创作与运营',
        url: 'https://creator.douyin.com/',
        letter: '抖'
      },
      {
        id: 'xhs-creator',
        name: '小红书创作服务平台',
        desc: '笔记发布与数据',
        url: 'https://creator.xiaohongshu.com/',
        letter: '红'
      }
    ]
  },
  {
    id: 'cat-webnovel',
    category: '网文写作',
    letter: '文',
    items: [
      {
        id: 'qidian-writer',
        name: '起点写作',
        desc: '阅文 / 起点作家后台',
        url: 'https://write.qq.com/',
        letter: '起'
      },
      {
        id: 'jjwxc',
        name: '晋江文学城',
        desc: '言情等网文创作平台',
        url: 'https://www.jjwxc.net/',
        letter: '晋'
      },
      {
        id: 'fanqie-writer',
        name: '番茄小说',
        desc: '番茄网文平台',
        url: 'https://fanqienovel.com/',
        letter: '番'
      },
      {
        id: 'qimao',
        name: '七猫中文网',
        desc: '七猫网文平台',
        url: 'https://www.qimao.com/',
        letter: '七'
      }
    ]
  }
]

export const DEFAULT_SITES = RAW_SITES.map((g) => {
  const items = (g.items || []).map((it) => ({
    ...it,
    icon: it.icon || iconFromSiteUrl(it.url)
  }))
  return {
    ...g,
    // 分类图标优先用显式配置，否则继承首个站点图标
    icon: g.icon || items[0]?.icon || iconFromSiteUrl(items[0]?.url || ''),
    items
  }
})

export function cloneDefaults() {
  return structuredClone(DEFAULT_SITES)
}

export function createId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function letterFromName(name = '') {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const first = trimmed[0]
  if (/[a-zA-Z0-9]/.test(first)) return first.toUpperCase()
  return first.slice(0, 1)
}
