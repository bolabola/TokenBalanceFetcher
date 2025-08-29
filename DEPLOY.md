# Vercel部署指南

## 准备工作

1. **安装Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **登录Vercel**
   ```bash
   vercel login
   ```

## 环境变量配置

在Vercel项目设置中需要配置以下环境变量：

### 必需的环境变量
```
NODE_ENV=production
PORT=3000
```

### 数据库相关（如果使用）
```
DATABASE_URL=your_database_connection_string
DRIZZLE_DATABASE_URL=your_database_connection_string
```

### 其他可能需要的环境变量
根据你的应用需求，可能还需要设置：
- API密钥
- 第三方服务配置
- 会话密钥等

## 部署步骤

### 方式1：使用Vercel CLI
```bash
# 在项目根目录执行
vercel

# 首次部署时按提示配置项目
# 后续部署直接运行 vercel 即可
```

### 方式2：连接Git仓库
1. 将代码推送到GitHub/GitLab/Bitbucket
2. 在Vercel网站上导入项目
3. 配置环境变量
4. 点击部署

## 项目结构说明

- `/client` - React前端应用
- `/server` - Express后端API
- `/shared` - 共享类型定义
- `vercel.json` - Vercel部署配置
- 构建输出目录：`/dist/public`

## 常见问题

### 1. 构建失败
检查所有依赖是否在dependencies中（而非devDependencies）

### 2. API路由404
确保vercel.json中的路由配置正确

### 3. 静态文件404
检查构建输出目录和路由配置

### 4. 数据库连接问题
确保环境变量正确设置并且数据库允许Vercel的IP访问

## 本地测试部署配置
```bash
# 构建项目
npm run build

# 本地预览
vercel dev
```