// Not a real example of a service, do not use for non-testing purposes
export class PermissionsService {
  private permissions: Record<number, string[]>

  constructor() {
    this.permissions = {}
  }

  setPermissions(userId: number, permissions: string[]) {
    this.permissions[userId] = permissions
    return Promise.resolve()
  }

  getUserPermissionsBulk(userIds: number[]) {
    const result = Object.entries(this.permissions)
      .filter((entry) => {
        return userIds.includes(Number.parseInt(entry[0], 10))
      })
      .map((entry) => {
        return entry[1]
      })
    return Promise.resolve(result)
  }

  deleteAll() {
    this.permissions = {}
    return Promise.resolve()
  }
}
