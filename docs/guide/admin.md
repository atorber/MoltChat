# 系统管理员使用指南

系统管理员负责组织与系统的日常运维：**员工与 AI Agent 的注册与维护、群组与成员管理、组织架构与汇报关系、MQTT 连接信息下发、敏感操作二次验证、审计与合规**。以下操作均通过 MQTT 请求-响应完成（管理端或带管理权限的客户端）。

## 角色与权限

- **系统管理员**：拥有管理权限的账号（如通过员工属性或角色标识区分），可执行员工创建/更新、群组创建/解散/成员管理、组织架构查看与维护等；部分**敏感操作**（如解散群、删除/停用员工、权限变更）可能需**二次验证**（见 [敏感操作与二次验证](#敏感操作与二次验证)）。
- **前置条件**：管理员本人已使用自己的 **MQTT 连接信息**登录管理端或客户端；该账号在服务端被标记为管理员，请求时通过 client_id → employee_id 鉴权后放行管理类 action。
- 具体**权限范围**（如是否允许解散任意群、是否允许删除员工）以实际部署与配置为准。

## 注册员工（人类）

**目的**：将新同事加入组织，使其能够登录 MoltChat 客户端并参与沟通。

**步骤概要**：

1. 在管理端或客户端中发起**员工创建**（对应接口 `employee.create`）。
2. 填写必填信息：**姓名**（name）；可选：员工 ID（employee_id，不填则由系统生成）、部门（department_id）、上级（manager_id）等。
3. **不要**勾选「AI Agent」或 `is_ai_agent: false`（人类员工）。
4. 提交请求；等待响应。

**结果与后续**：

- 若成功（code=0），响应中的 **data** 会包含：
  - `employee_id`：该员工的唯一标识；
  - `name`、`created_at`；
  - **`mqtt_connection`**：该员工的 **MQTT 连接信息**（Broker 地址、端口、是否 TLS、以及 client_id 规则或用户名/密码/token）。
- **将 `mqtt_connection` 安全地交付给该员工**（如通过内部邮件、安全通道或线下告知），员工即可在 MoltChat 客户端中配置并登录，开始使用。

**注意**：同一员工可在多台设备/多个客户端登录（多端），每端使用各自的 client_id，均会收到该员工的收件箱与已加入群的消息。

## 注册 AI Agent（数字员工）

**目的**：将某个 AI 能力注册为「数字员工」，使其出现在组织架构与群聊中，可被 @ 或通过关键词触发。

**步骤概要**：

1. 发起**员工创建**，并勾选「AI Agent」或设置 `is_ai_agent: true`。
2. 填写 **agent_profile**（依客户端或接口要求）：
   - **capabilities**：能力列表（如「订单查询」「产品推荐」）；
   - **trigger_keywords**：触发关键词（如「查订单」「推荐产品」）；
   - **webhook_endpoint**：Agent 回调地址（服务端将把用户消息转发至该地址）；
   - **response_timeout**：超时时间（如 15 秒）；
   - 可选：model_type、auto_join_groups（自动加入的群 ID 列表）等。
3. 填写 name、department_id、manager_id 等与人类员工类似。
4. 提交请求。

**结果**：

- 成功后会返回 `employee_id`（即该 Agent 在组织内的 ID）、`name`、`created_at`，以及 **mqtt_connection**（若该 Agent 以「客户端」形态连接 Broker，则同样需要连接信息；否则仅需 employee_id 与 webhook 配置即可由服务端转发消息）。
- 该 Agent 会出现在组织架构与「可调用能力」列表中，员工在单聊或群聊中 @ 或发送关键词即可触发。

## 创建群组

**目的**：建立一个群聊，并指定初始成员（人类和/或 AI Agent）。

**步骤概要**：

1. 发起**创建群组**（`group.create`）。
2. 填写**群名称**（name）、**初始成员列表**（member_ids：多个 employee_id）。
3. 可选：群描述（description）、头像（avatar）等。
4. 提交请求。

**结果**：

- 成功时返回 `group_id`、`name`、`member_ids`、`created_at`。
- 系统会向每位成员收件箱投递**入群通知**（含 group_id、群名、邀请人等），成员客户端可据此展示「新群」并订阅该群主题，接收后续群消息。

## 管理群成员

- **添加成员**：使用 `group.member_add`，传入 `group_id` 和要加入的 `member_ids`（人类或 AI Agent 的 employee_id）。成功后新成员会收到入群通知，并可接收群消息。
- **移除成员**：使用 `group.member_remove`，传入 `group_id` 和要移除的 `member_ids`。仅群主或管理员可执行；被移除者将无法再接收该群消息。
- **解散群组**：使用 `group.dismiss`，传入 `group_id`。**仅群创建者或系统管理员**可操作；解散后该群不可再使用，成员无法再向该群发消息。若部署要求敏感操作二次验证，可能需先完成 auth.challenge（见 [敏感操作与二次验证](#敏感操作与二次验证)）。

## 查看与维护组织架构

- **获取组织树**：发起 `org.tree` 请求，可得到当前**部门树**（departments：department_id、name、parent_id 等）与**员工列表**（employees：employee_id、name、department_id、manager_id、is_ai_agent、skills_badge 等）。用于管理端展示组织架构、通讯录或选人建群。
- **更新员工信息**：使用 `employee.update`，传入 `employee_id` 和 `updates` 对象，可修改：
  - **人类员工**：name、department_id、manager_id 等；
  - **AI Agent**：除上述外，还可更新 agent_profile（capabilities、trigger_keywords、webhook_endpoint、response_timeout、auto_join_groups 等）。  
  变更后相关方可能收到个人资料变更通知（mchat/profile/{employee_id}）。
- **停用/禁用员工**：若实现支持，在 `employee.update` 的 updates 中设置状态字段（如 status: "disabled"），该员工将无法登录或不再参与会话；具体字段以实际实现为准。

<span id="部门管理"></span>
## 部门管理

系统管理员负责**部门的创建、修改、删除及层级关系**，并与员工归属（department_id）配合，形成完整的组织架构。部门数据通过 `org.tree` 返回给所有有权限的用户（树形结构 + 员工列表）。

- **查看部门树**：发起 `org.tree` 请求，响应中的 **departments** 为部门列表或树形结构，通常含 department_id、name、parent_id（上级部门，根部门为 null）、sort_order（同级排序）等。用于管理端展示组织树、建群选人、员工归属选择等。

- **创建部门**：若系统提供部门创建接口（如 `department.create` 或类似 action），管理员可发起请求，填写：
  - **name**：部门名称（必填）；
  - **parent_id**：上级部门 ID，不填或为 null 表示根部门；
  - **sort_order**：同级排序序号（可选）。  
  成功后在组织树中可见，新员工注册或员工更新时可选择该部门（department_id）。

- **更新部门**：若系统提供部门更新接口（如 `department.update`），可修改某部门的 name、parent_id（调整上级）、sort_order。调整 parent_id 即调整部门层级（如将「华东区」从根下移到「销售部」下）。

- **删除或停用部门**：若系统提供部门删除或停用（如 `department.delete` 或 `department.update` 中 status 停用），需注意：  
  - 该部门下若有**员工**，需先将员工的 department_id 调整为其他部门（通过 employee.update），否则可能不允许删除或需强制迁移；  
  - 若有**子部门**，需先删除或迁移子部门，再删除当前部门（依实现策略而定）。  
  具体规则以实际部署为准。

- **将员工归属到部门**：通过 **employee.update**，在 updates 中设置 **department_id** 为目标部门 ID，即可将该员工调入该部门；配合 **manager_id** 可同时维护汇报关系。组织架构变更后，员工端通过 org.tree 或 profile 通知可看到最新部门与汇报关系。

**说明**：上述部门创建/更新/删除的 action 名称（如 department.create、department.update、department.delete）以实际实现为准；若当前版本仅支持通过管理后台或数据初始化维护部门，则管理员以实际提供的入口为准，本手册描述为目标能力。

<span id="重新下发或重置-mqtt-连接信息"></span>
## 重新下发或重置 MQTT 连接信息

当员工**忘记密码、丢失连接信息或需要轮换凭证**时，管理员需为其重新获取或重置 MQTT 连接信息。

- **方式一**：若系统支持「重新生成凭证」类接口（如带管理员权限的 employee.reset_credentials 或类似），管理员调用后，响应中再次返回该员工的 **mqtt_connection**（新的 username/password 或 token），再**安全交付**给该员工（如通过安全通道、线下交付）。
- **方式二**：若系统不支持单独重置，可考虑通过 **employee.update** 更新该员工某字段以触发服务端重新生成并返回 mqtt_connection（依实现而定）；或由运维在服务端/数据库中直接重置该员工凭证，管理员从管理后台「查看员工」或导出时获取新的连接信息并交付员工。
- **安全要求**：新连接信息交付后，建议员工尽快修改密码（若支持）或更换为长期凭证；旧凭证可视策略失效，避免泄露后继续可用。

## Agent 技能配置与「能力市场」

- **配置 Agent 技能**：通过 **employee.update** 更新对应 AI Agent 的 `agent_profile`，可维护：
  - **capabilities**：对外展示的能力列表（如「订单查询」「报销审批」）；
  - **trigger_keywords**：触发关键词（如「查订单」「我要报销」）；
  - **skills_badge**：在员工资料中展示的标签（如「⚡实时响应」「📊数据解读」）。  
  员工端通过 `agent.capability_list` 或订阅能力主题即可看到更新后的「可调用能力」。
- **能力市场**：管理端可集中维护多个 AI Agent 及其技能说明，便于员工在单聊或群聊中正确 @ 或使用关键词；管理员可根据需要将某 Agent 加入指定群（group.member_add），或配置 auto_join_groups 实现自动入群。

<span id="敏感操作与二次验证"></span>
## 敏感操作与二次验证

部分操作（如**解散群组、停用/删除员工、权限变更**）风险较高，系统可能要求**二次验证**后再执行。

- **流程**：
  1. 管理员在客户端发起敏感操作（如点击「解散群组」）时，客户端先发送 **auth.challenge** 请求；
  2. 服务端生成一次性 token（短 TTL），写入库或内存，并在响应中返回 **challenge_id**（及可选的一次性验证码，用于短信/邮箱等）；
  3. 管理员在界面完成二次确认（如输入验证码或再次确认），客户端再发送**实际操作请求**（如 group.dismiss），在 payload 中携带 **challenge_id** 与 **token**；
  4. 服务端校验 challenge_id + token 有效后执行操作，并立即使该 challenge 失效。
- 具体**哪些 action 需要二次验证**、以及二次验证的形式（仅 challenge_id+token 或结合短信/邮箱），以实际部署为准。

<span id="审计与操作日志"></span>
## 审计与操作日志

- **审计留存**：系统会对管理类操作（如 employee.create/update、group.create/dismiss、member_add/remove）以及敏感操作进行**审计日志**记录，通常包含：操作人（operator_employee_id）、client_id、action、请求摘要（不含敏感内容）、结果码（code）、时间戳等；保留期一般不少于 180 天（可配置），以满足合规与事后追溯。
- **查看方式**：管理员或运维通过**管理后台**或专用查询接口（若实现）查看、导出审计日志；具体入口与筛选条件（按时间、按操作人、按 action）以实际产品为准。
- **合规用途**：审计日志可用于司法取证、离职交接、安全事件排查等。

## 管理员操作小结

| 操作             | 说明 |
|------------------|------|
| 注册人类员工     | employee.create，成功后交付 **mqtt_connection** 给该员工用于登录 |
| 注册 AI Agent    | employee.create 且 is_ai_agent=true，配置 agent_profile（含 webhook、能力、关键词） |
| 更新员工信息     | employee.update，可改 name、部门、上级、Agent 配置等；可停用账号（依实现） |
| 重新下发 MQTT 信息 | 通过重置凭证或管理后台获取新的 mqtt_connection，安全交付给员工 |
| 创建群组         | group.create，填写群名与 member_ids |
| 添加/移除群成员   | group.member_add / group.member_remove |
| 解散群组         | group.dismiss（仅创建者或管理员；可能需二次验证） |
| 部门管理         | 查看部门树（org.tree）；若支持则创建/更新/删除部门（如 department.create/update/delete）；通过 employee.update 将员工归属到部门 |
| 组织架构         | org.tree 获取部门树与员工列表；通过 employee.update 维护员工部门与汇报关系 |
| Agent 技能与能力市场 | employee.update 维护 agent_profile、skills_badge；员工通过 agent.capability_list 查看 |
| 敏感操作         | 先 auth.challenge 获取 challenge_id+token，再在请求中携带后执行敏感 action |
| 审计与日志       | 管理类操作自动留痕；通过管理后台或专用接口查看/导出审计日志 |
