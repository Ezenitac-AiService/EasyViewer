export type IpClassification = 'blocked-high-risk' | 'private-network' | 'public'

export interface ValidatedRemoteUrl {
  url: URL
  hostname: string
  port: number
  classification: IpClassification
}

export function parseIpv4Part(part: string): number | null
export function parseIpv4Bytes(host: string): [number, number, number, number] | null
export function classifyIpv4Bytes(bytes: [number, number, number, number]): IpClassification
export function expandIpv6Groups(raw: string): number[] | null
export function classifyIpAddress(rawIp: string): IpClassification
export function validateRemoteUrlSyntax(rawUrl: string): ValidatedRemoteUrl
