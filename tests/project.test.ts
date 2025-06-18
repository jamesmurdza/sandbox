import { AxiosResponse } from "axios"
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  test,
} from "vitest"
import { apiClient } from "./utils/api"
import { env } from "./utils/env"

const BEFORE_ALL_TIMEOUT = 30000 // 30 sec

const PROJECT_TEMPLATES = ["reactjs", "vanillajs", "nextjs", "streamlit", "php"]
let noOfSandboxes = 0
describe("GET /api/project", () => {
  let mainResponse: AxiosResponse
  let mainBody: Array<{ [key: string]: unknown }>

  beforeAll(async () => {
    mainResponse = await apiClient.get("/project")
    mainBody = mainResponse.data
  }, BEFORE_ALL_TIMEOUT)

  test("Should have response status 200", () => {
    expect(mainResponse.status).toBe(200)
  })

  test("Should have array in the body", async () => {
    expectTypeOf(mainBody).toBeArray()
    noOfSandboxes = mainBody.length
  })

  test("Should have array of objects in the body", async () => {
    expect(mainBody[0]).toBeInstanceOf(Object)
  })
  test("With query params", async () => {
    const firstItem = mainBody[0]
    const response = await apiClient.get(`/project?id=${firstItem.id}`)
    const body = response.data
    expect(body).toBeInstanceOf(Object)
  })
})

let createdSandboxId: string
describe("POST /api/project", () => {
  test("Should create a sandbox", async () => {
    const response = await apiClient.post("/project", {
      name: "Vitest Sandbox",
      userId: env.CLERK_TEST_USER_ID,
      type: PROJECT_TEMPLATES[0],
      visibility: "private",
    })

    expect(response.status).toBe(200)
    const data = response.data

    expect(data).toHaveProperty("data")
    expect(data.data).toHaveProperty("sandbox")
    expect(data.data.sandbox).toHaveProperty("id")
    expectTypeOf(data.data.sandbox.id).toBeString
    createdSandboxId = response.data.data.sandbox.id
  })
})

describe("PATCH /api/project", () => {
  test("Should update sandbox by ID", async () => {
    const updatedInfo = {
      id: createdSandboxId,
      name: "Updated Vitest Sandbox",
      visibility: "public",
    }
    const response = await apiClient.patch(`/project`, updatedInfo)
    expect(response.status).toBe(200)
    const data = response.data
    expect(data).toHaveProperty("data")
    expect(data.data).toHaveProperty("sandbox")
    expect(data.data.sandbox).toHaveProperty("name")
    expect(data.data.sandbox.name).toBe(updatedInfo.name)
  })
})

describe("POST /api/project/like", () => {
  test("Should return 400 for missing fields", async () => {
    const response = await apiClient.post("/project/like", {
      sandboxId: createdSandboxId,
    })
    expect(response.status).toBe(400)
  })

  test("Should like and unlike sandbox", async () => {
    // Like
    const likeResponse = await apiClient.post("/project/like", {
      sandboxId: createdSandboxId,
      userId: env.CLERK_TEST_USER_ID,
    })
    expect(likeResponse.status).toBe(200)
    const likeBody = likeResponse.data

    expect(likeBody).toHaveProperty("data")
    expect(likeBody.data).toHaveProperty("liked")
    expect(likeBody.data.liked).toBe(true)

    // Unlike
    const unlikeResponse = await apiClient.post("/project/like", {
      sandboxId: createdSandboxId,
      userId: env.CLERK_TEST_USER_ID,
    })
    expect(unlikeResponse.status).toBe(200)
    const unlikeBody = unlikeResponse.data

    expect(unlikeBody).toHaveProperty("data")
    expect(unlikeBody.data).toHaveProperty("liked")
    expect(unlikeBody.data.liked).toBe(false)
  })
})

describe("GET /api/project/like", () => {
  let createdSandboxId: string

  beforeAll(async () => {
    const response = await apiClient.get("/project")
    const sandboxes = response.data
    createdSandboxId = sandboxes[0]?.id
  }, BEFORE_ALL_TIMEOUT)

  test("Should return 400 for missing params", async () => {
    const response = await apiClient.get("/project/like?sandboxId=test")
    expect(response.status).toBe(400)
  })

  test("Should return like status", async () => {
    const response = await apiClient.get(
      `/project/like?sandboxId=${createdSandboxId}&userId=${env.CLERK_TEST_USER_ID}`
    )
    const body = response.data

    expect(response.status).toBe(200)
    expect(body).toHaveProperty("data")
    expect(body.data).toHaveProperty("liked")
    expectTypeOf(body.data.liked).toBeBoolean
  })
})

describe("DELETE /api/project?id=xxx", () => {
  test("Should delete a sandbox", async () => {
    const response = await apiClient.delete(`/project?id=${createdSandboxId}`)
    const data = response.data

    expect(response.status).toBe(200)
    expect(data).toHaveProperty("message")
    expect(data.message).toBe("Sandbox Deleted successfully")
  })
})

const SANDBOX_LIMIT = 8
describe("POST /api/project (limit enforcement)", () => {
  const sandboxIds: string[] = []

  beforeAll(async () => {
    const sandboxesToCreate = SANDBOX_LIMIT - noOfSandboxes
    for (let i = 0; i < sandboxesToCreate; i++) {
      const res = await apiClient.post("/project", {
        name: `Box ${i}`,
        userId: env.CLERK_TEST_USER_ID,
        type: PROJECT_TEMPLATES[i % PROJECT_TEMPLATES.length],
        visibility: "private",
      })
      const id = res.data.data.sandbox.id
      sandboxIds.push(id)
    }
  }, BEFORE_ALL_TIMEOUT)

  test("Should reject sandbox creation beyond limit", async () => {
    const response = await apiClient.post("/project", {
      name: "Overflow Box",
      userId: env.CLERK_TEST_USER_ID,
      type: PROJECT_TEMPLATES[0],
      visibility: "private",
    })

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.data.message).toMatch(/maximum/i)
  })

  afterAll(async () => {
    await Promise.all(
      sandboxIds.map((id) => apiClient.delete(`/project?id=${id}`))
    )
  })
})
