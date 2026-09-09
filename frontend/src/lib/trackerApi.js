import axios from "axios";
import { getAccessToken } from "./api";

const TRACKER_BASE_URL =
  import.meta.env.VITE_TRACKER_API_URL || "http://localhost:8001/api/v1";

const trackerClient = axios.create({
  baseURL: TRACKER_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

trackerClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const trackerApi = {
  baseUrl: TRACKER_BASE_URL,

  async getProfile(scrapId) {
    const res = await trackerClient.get(`/profiles/${scrapId}`);
    return res.data;
  },

  async createOrUpdateProfile(data) {
    const res = await trackerClient.post("/profiles/", data);
    return res.data;
  },

  async resolveScan(token) {
    const res = await trackerClient.get(`/scan/${token}`);
    return res.data;
  },

  async claimScrap(token, data) {
    const res = await trackerClient.post(`/scan/${token}/claim`, data);
    return res.data;
  },

  async relocateScrap(token, data) {
    const res = await trackerClient.post(`/scan/${token}/relocate`, data);
    return res.data;
  },

  async getScrapEvents(scrapId) {
    const res = await trackerClient.get(`/scraps/${scrapId}/events`);
    return res.data;
  },

  getQrImageUrl(token, size = 300) {
    return `${TRACKER_BASE_URL}/qr/${token}/image?size=${size}`;
  },

  getThermalLabelUrl(token) {
    return `${TRACKER_BASE_URL}/qr/${token}/label`;
  },
};

export default trackerApi;
