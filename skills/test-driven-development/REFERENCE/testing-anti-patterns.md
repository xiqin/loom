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

**好的做法：**
- 通过公共接口测试
- 使用依赖注入，在测试中替换依赖
- 测试输出和行为，不测试内部实现

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
问题：mock 掩盖了真实的依赖行为，可能错过集成问题。

**好的做法：**
- 尽可能使用真实依赖
- 如果必须 mock，确保理解被 mock 的依赖的真实行为
- 编写集成测试覆盖真实依赖交互

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

## 总结

- 测试真实行为，不是 mock 行为
- 不污染生产代码
- 理解依赖关系
- 测试要专注（一个行为一个测试）
- 覆盖边界条件
