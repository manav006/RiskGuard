import axios from 'axios'
import { API_BASE_URL } from './config'

const api = axios.create({
  baseURL: API_BASE_URL,
})

export async function fetchData(path) {
  const { data } = await api.get(path)
  return data
}
