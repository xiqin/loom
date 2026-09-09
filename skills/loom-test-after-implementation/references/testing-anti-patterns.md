# 测试反模式

## 常见陷阱

### 1. 测试 mock 行为而不是真实行为

**坏的示例：**
```typescript
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);
});
```
问题：测试的是 mock 的行为，不是真实代码的重试逻辑。

**好的做法：**
测试真实的函数实现，只有在不可避免时才使用 mock。

### 2. 向生产类添加仅测试的方法

**坏的示例：**
```typescript
class UserService {
  // 生产代码
  createUser(data: UserData) { ... }
  
  // 仅用于测试的方法
  _testGetInternalState() { return this.internalState; }
}
```
问题：污染生产代码。

**好的做法（按优先级）：**
- 通过公共接口测试，测试输出和行为，不测试内部实现
- **真实依赖能用就不用注入**：
  - 文件 I/O → `mkdtempSync` 真实临时目录 + afterEach 清理
  - 数据库 → 内存实例（如 SQLite `:memory:`）
  - 时间 → 注入 `now` 参数或测试框架的时间冻结（如 `vi.setSystemTime()`）
- **仅三种边界允许注入依赖替换**：
  1. 外部网络/计费 API（如 LLM 客户端）——用内联 fake 对象（如 `{ complete: async () => '...' }`），**不为它建实现类**
  2. 副作用不可回滚（发邮件、支付、推送）
  3. 非确定性且无法以其他方式控制（如 `crypto.random`）
- **红线**：如果"为 X 写接口"会让接口层 >50 行且 ≥80% 是对框架/标准库 API 的无逻辑转发（薄壳），直接拒绝该抽象，改用真实依赖

### 3. 在不理解依赖关系的情况下 mock

**坏的示例：**
```typescript
test('saves user', () => {
  const mockRepo = { save: jest.fn() };
  const service = new UserService(mockRepo);
  service.createUser(data);
  expect(mockRepo.save).toHaveBeenCalled();
});
```
问题：mock 掩盖了真实的依赖行为，可能错过集成问题。更严重的是，为了能注入 mockRepo 而给 UserService 加构造参数，是 test-induced design damage。

**好的做法：**
- 尽可能使用真实依赖
- 如果必须 mock，确保理解被 mock 的依赖的真实行为
- 编写集成测试覆盖真实依赖交互
- 不为 mock 而改生产代码的构造签名

### 4. 测试过于宽泛

**坏的示例：**
```typescript
test('user creation works', () => {
  // 测试了一堆东西：验证、保存、发送邮件、记录日志...
});
```
问题：一个测试测试太多东西，失败时难以定位问题。

**好的做法：**
- 每个测试只测试一个行为
- 名称清晰描述测试的行为
- 使用 Arrange-Act-Assert 结构

### 5. 忽略边界条件

**坏的示例：**
```typescript
test('divides correctly', () => {
  expect(divide(10, 2)).toBe(5);
});
```
问题：没有测试边界条件（除零、负数、小数等）。

**好的做法：**
- 测试正常流程
- 测试异常流程（错误处理）
- 测试边界条件（0、负数、null、undefined、最大值等）

### 6. 为可测试性而设计（test-induced design damage）

**坏的示例：**
```typescript
// 为能 mock 文件系统而建抽象
interface FileSystem {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
}
class RealFileSystem implements FileSystem { /* 转发 Node fs */ }
// 仅测试用 InMemoryFileSystem implements FileSystem
```
问题：FileSystem 抽象是对标准库的无逻辑薄壳转发，只为测试而存在。这是 mockist 风格驱使出的设计——即使取消测试先行，惯性仍会带回来。

**好的做法：**
- 文件 I/O 用 `mkdtempSync` 真实临时目录，不建文件系统抽象
- 依赖替换仅限三边界
- 设计服务于业务需求，不服务于测试便利

### 7. 跳过重构直接写测试

**坏的示例：**
实现完成后直接写测试，测试接触的是未清理的凌乱代码。之后重构发现测试绑定了一堆实现细节，改不动了。

**好的做法：**
实现 → 重构 → 写测试。测试锁定的是重构后的干净结构。

## 总结

- 测试真实行为，不是 mock 行为
- 不污染生产代码（不添加仅测试用的构造参数/接口/方法）
- 注入替换仅限三边界：外部网络/计费 API、不可回滚副作用、不可控非确定性——其余一律真实依赖
- 文件 I/O 用真实临时目录（mkdtempSync），不建内存文件系统类
- 理解依赖关系
- 测试要专注（一个行为一个测试）
- 覆盖边界条件
- 先重构再写测试，让测试锁定干净结构
- 覆盖率是发现工具，不是达标指标
