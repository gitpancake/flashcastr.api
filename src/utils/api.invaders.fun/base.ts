import axios, { AxiosInstance } from "axios";

export abstract class BaseApi {
  protected readonly api: AxiosInstance;

  constructor() {
    if (!process.env.INVADERS_API_URL) {
      throw new Error("INVADERS_API_URL is not set");
    }

    this.api = axios.create({
      baseURL: process.env.INVADERS_API_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
