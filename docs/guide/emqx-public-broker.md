# 使用 EMQ 公共 MQTT Broker

如果你暂时没有自己的 MQTT Broker，可以使用 [EMQ 免费公共 MQTT Broker](https://www.emqx.com/zh/mqtt/public-mqtt5-broker) 进行快速测试和原型开发。

!!! warning "安全提示"
    公共 Broker 上的所有消息对其他用户可见，**请勿发送敏感数据**。仅建议用于测试和原型验证，生产环境请使用私有 Broker。

## 连接信息

| 配置项 | 值 |
|--------|-----|
| **Broker 地址** | `broker.emqx.io` |
| **TCP 端口** | `1883` |
| **WebSocket 端口** | `8083` |
| **TLS 端口** | `8883` |
| **WSS 端口** | `8084` |
| **QUIC 端口** | `14567` |

更多信息请参考：[EMQ 公共 MQTT Broker 官方页面](https://www.emqx.com/zh/mqtt/public-mqtt5-broker)

## 服务端配置示例

在 `server/config/config.yaml` 中配置 broker 部分：

```yaml
broker:
  host: broker.emqx.io
  port: 1883          # TCP 端口
  useTls: false
  username: ""        # 公共 Broker 无需认证
  password: ""
  clientId: mchat-server-xxx  # 建议使用唯一 ID 避免冲突
```

如需使用 TLS 加密连接：

```yaml
broker:
  host: broker.emqx.io
  port: 8883          # TLS 端口
  useTls: true
  username: ""
  password: ""
  clientId: mchat-server-xxx
```

## 管理后台连接

在管理后台登录页填写：

| 配置项 | 值 |
|--------|-----|
| **Broker WebSocket 地址** | `ws://broker.emqx.io:8083/mqtt`（非加密）<br>或 `wss://broker.emqx.io:8084/mqtt`（加密） |
| **MQTT 用户名** | 留空 |
| **MQTT 密码** | 留空 |
| **员工 ID** | `admin`（或你创建的员工 ID） |
| **Client ID** | 自定义唯一 ID，如 `mchat-admin-xxx` |

## 客户端连接

### Android / iOS 客户端

在客户端登录页配置：

- **服务器地址**：`broker.emqx.io`
- **端口**：`1883`（TCP）或 `8883`（TLS）
- **用户名/密码**：留空
- **Client ID**：使用唯一 ID

### SDK 连接

Node.js SDK 示例：

```javascript
const client = new MoltChatClient({
  broker: {
    host: 'broker.emqx.io',
    port: 1883,
    useTls: false,
    clientId: 'mchat-sdk-xxx'
  },
  employeeId: 'your-employee-id'
});
```

Python SDK 示例：

```python
client = MoltChatClient(
    broker_host='broker.emqx.io',
    broker_port=1883,
    use_tls=False,
    client_id='mchat-sdk-xxx',
    employee_id='your-employee-id'
)
```

## 注意事项

1. **Client ID 唯一性**：公共 Broker 有大量用户，请确保你的 Client ID 足够唯一，建议加入随机后缀或 UUID，避免与他人冲突导致连接被踢。

2. **Topic 隔离**：建议在 `config.yaml` 中设置唯一的 `serviceId`，确保你的消息 Topic 与其他用户隔离：
   ```yaml
   serviceId: my-unique-service-id-xxx
   ```

3. **连接稳定性**：公共 Broker 提供 99.9% 可用性，但不保证与付费服务相同的 SLA，测试期间可能偶有波动。

4. **消息可见性**：公共 Broker 上的消息可被任何人订阅，请勿传输任何敏感或隐私数据。

## 准备正式部署？

完成测试后，建议迁移到私有 MQTT Broker：

| 方案 | 说明 |
|------|------|
| **[EMQX Cloud](https://www.emqx.com/zh/cloud)** | 全托管云服务，有免费 Serverless 套餐（每月 100 万会话） |
| **[EMQX 企业版](https://www.emqx.com/zh/products/emqx)** | 自托管部署，可在本地/边缘/私有云运行 |
| **EMQX 开源版** | 免费自建，适合有运维能力的团队 |
| **百度 IoT Core** | 百度智能云物联网核心套件 |

私有 Broker 提供：认证授权、数据隔离、更高可用性、企业级支持等能力。
