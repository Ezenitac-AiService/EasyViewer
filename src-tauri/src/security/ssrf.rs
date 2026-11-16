use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use url::Url;

pub struct PinnedSsrfResolver {
    pub pinned: Arc<Mutex<HashMap<String, IpAddr>>>,
}

impl reqwest::dns::Resolve for PinnedSsrfResolver {
    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
        let host = name
            .as_str()
            .trim_start_matches('[')
            .trim_end_matches(']')
            .trim_end_matches('.')
            .to_ascii_lowercase();
        let ip_opt = self.pinned.lock().ok().and_then(|map| map.get(&host).copied());
        Box::pin(async move {
            match ip_opt {
                Some(ip) => {
                    let addrs: reqwest::dns::Addrs =
                        Box::new(std::iter::once(SocketAddr::new(ip, 0)));
                    Ok(addrs)
                }
                None => Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::PermissionDenied,
                    format!("BLOCKED_HIGH_RISK: DNS resolution not pre-pinned for host: {host}"),
                )) as Box<dyn std::error::Error + Send + Sync>),
            }
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IpClassification {
    BlockedHighRisk,
    PrivateNetwork,
    Public,
}

pub fn classify_ipv4(ip: Ipv4Addr) -> IpClassification {
    let o = ip.octets();
    if o[0] == 0
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_multicast()
        || ip.is_broadcast()
        || o[0] >= 224
    {
        return IpClassification::BlockedHighRisk;
    }
    let is_cgnat = o[0] == 100 && (64..=127).contains(&o[1]);
    if ip.is_private() || is_cgnat {
        return IpClassification::PrivateNetwork;
    }
    IpClassification::Public
}

pub fn classify_ipv6(ip: Ipv6Addr) -> IpClassification {
    if let Some(mapped_v4) = ip.to_ipv4_mapped() {
        return classify_ipv4(mapped_v4);
    }
    if ip.is_unspecified() || ip.is_loopback() || ip.is_multicast() {
        return IpClassification::BlockedHighRisk;
    }
    let seg0 = ip.segments()[0];
    if (seg0 & 0xffc0) == 0xfe80 {
        return IpClassification::BlockedHighRisk;
    }
    if (seg0 & 0xfe00) == 0xfc00 {
        return IpClassification::PrivateNetwork;
    }
    IpClassification::Public
}

pub fn classify_ip(ip: IpAddr) -> IpClassification {
    match ip {
        IpAddr::V4(v4) => classify_ipv4(v4),
        IpAddr::V6(v6) => classify_ipv6(v6),
    }
}

pub fn classify_ip_str(raw: &str) -> Result<IpClassification, String> {
    let trimmed = raw.trim().trim_start_matches('[').trim_end_matches(']');
    let without_zone = trimmed.split('%').next().unwrap_or("");
    if without_zone.is_empty() {
        return Ok(IpClassification::BlockedHighRisk);
    }
    if let Ok(ip) = without_zone.parse::<IpAddr>() {
        return Ok(classify_ip(ip));
    }
    if let Ok(parsed) = Url::parse(&format!("http://{without_zone}")) {
        if let Some(host) = parsed.host() {
            match host {
                url::Host::Ipv4(v4) => return Ok(classify_ipv4(v4)),
                url::Host::Ipv6(v6) => return Ok(classify_ipv6(v6)),
                url::Host::Domain(_) => {}
            }
        }
    }
    Err(format!("INVALID_IP: 해석할 수 없는 IP 리터럴입니다: {raw}"))
}

pub fn is_allowed_method(method: &str) -> Result<reqwest::Method, String> {
    let upper = method.trim().to_ascii_uppercase();
    match upper.as_str() {
        "GET" | "HEAD" | "OPTIONS" | "PROPFIND" | "POST" => {
            reqwest::Method::from_bytes(upper.as_bytes()).map_err(|e| e.to_string())
        }
        _ => Err(format!("METHOD_NOT_ALLOWED: 허용되지 않은 HTTP 메서드입니다: {upper}")),
    }
}

pub fn validate_url_syntax(raw_url: &str) -> Result<Url, String> {
    let parsed =
        Url::parse(raw_url.trim()).map_err(|e| format!("INVALID_URL: 잘못된 URL 형식입니다: {e}"))?;
    match parsed.scheme() {
        "http" | "https" => {}
        scheme => return Err(format!("BLOCKED_SCHEME: 허용되지 않은 프로토콜입니다: {scheme}")),
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("INVALID_URL: URL 내 내장 자격 증명은 허용되지 않습니다.".into());
    }
    if parsed.host_str().is_none() {
        return Err("INVALID_URL: 호스트가 지정되지 않았습니다.".into());
    }
    Ok(parsed)
}

pub fn check_ip_policy(ip: IpAddr, allow_private_nas: bool) -> Result<(), String> {
    match classify_ip(ip) {
        IpClassification::BlockedHighRisk => {
            Err("BLOCKED_HIGH_RISK: 보안 정책에 의해 차단된 내부 네트워크 주소입니다.".into())
        }
        IpClassification::PrivateNetwork if !allow_private_nas => Err(
            "PRIVATE_NETWORK_CONFIRM_REQUIRED: 사설 네트워크(NAS) 접근에는 사용자 승인이 필요합니다."
                .into(),
        ),
        _ => Ok(()),
    }
}

pub fn resolve_and_pin_host(url: &Url, allow_private_nas: bool) -> Result<(String, SocketAddr), String> {
    let port = url
        .port_or_known_default()
        .ok_or_else(|| "INVALID_URL: 포트를 결정할 수 없습니다.".to_string())?;
    let host = url
        .host()
        .ok_or_else(|| "INVALID_URL: 호스트가 없습니다.".to_string())?;

    let domain = match host {
        url::Host::Ipv4(v4) => {
            let ip = IpAddr::V4(v4);
            check_ip_policy(ip, allow_private_nas)?;
            return Ok((v4.to_string(), SocketAddr::new(ip, port)));
        }
        url::Host::Ipv6(v6) => {
            let ip = IpAddr::V6(v6);
            check_ip_policy(ip, allow_private_nas)?;
            return Ok((v6.to_string(), SocketAddr::new(ip, port)));
        }
        url::Host::Domain(raw_domain) => raw_domain.trim_end_matches('.').to_ascii_lowercase(),
    };

    if domain == "localhost" || domain.ends_with(".localhost") {
        return Err("BLOCKED_HIGH_RISK: 보안 정책에 의해 차단된 내부 네트워크 주소입니다.".into());
    }
    if domain.ends_with(".local") && !allow_private_nas {
        return Err(
            "PRIVATE_NETWORK_CONFIRM_REQUIRED: 사설 네트워크(.local) 접근에는 사용자 승인이 필요합니다."
                .into(),
        );
    }

    let addrs: Vec<SocketAddr> = (domain.as_str(), port)
        .to_socket_addrs()
        .map_err(|e| format!("DNS_RESOLUTION_FAILED: 호스트 주소를 해석할 수 없습니다: {e}"))?
        .collect();
    if addrs.is_empty() {
        return Err("DNS_RESOLUTION_FAILED: 해석된 IP 주소가 없습니다.".into());
    }
    for addr in &addrs {
        check_ip_policy(addr.ip(), allow_private_nas)?;
    }
    Ok((domain, addrs[0]))
}

pub fn same_origin(a: &Url, b: &Url) -> bool {
    a.scheme() == b.scheme()
        && a.host_str().map(|h| h.to_ascii_lowercase())
            == b.host_str().map(|h| h.to_ascii_lowercase())
        && a.port_or_known_default() == b.port_or_known_default()
}

pub fn compute_remaining_budget(deadline: Instant, now: Instant) -> Result<Duration, String> {
    if now >= deadline {
        return Err("TIMEOUT: 원격 요청 총 제한 시간이 초과되었습니다.".into());
    }
    Ok(deadline.saturating_duration_since(now))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_ipv4_and_ipv6_ssrf_targets() {
        assert_eq!(classify_ip(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1))), IpClassification::BlockedHighRisk);
        assert_eq!(classify_ip(IpAddr::V4(Ipv4Addr::new(169, 254, 169, 254))), IpClassification::BlockedHighRisk);
        assert_eq!(classify_ip(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 10))), IpClassification::PrivateNetwork);
        assert_eq!(classify_ip(IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8))), IpClassification::Public);
        assert_eq!(classify_ip(IpAddr::V6(Ipv6Addr::LOCALHOST)), IpClassification::BlockedHighRisk);
        assert_eq!(classify_ip("::ffff:127.0.0.1".parse::<IpAddr>().unwrap()), IpClassification::BlockedHighRisk);
        assert_eq!(classify_ip("fc00::1".parse::<IpAddr>().unwrap()), IpClassification::PrivateNetwork);
        assert_eq!(classify_ip("fe80::1".parse::<IpAddr>().unwrap()), IpClassification::BlockedHighRisk);
    }

    #[test]
    fn matches_three_way_ssrf_equivalence_vectors() {
        let vectors = [
            ("127.0.0.1", IpClassification::BlockedHighRisk),
            ("0.0.0.0", IpClassification::BlockedHighRisk),
            ("169.254.169.254", IpClassification::BlockedHighRisk),
            ("::1", IpClassification::BlockedHighRisk),
            ("fe80::1%en0", IpClassification::BlockedHighRisk),
            ("[fe80::1%en0]", IpClassification::BlockedHighRisk),
            ("0177.0.0.1", IpClassification::BlockedHighRisk),
            ("2130706433", IpClassification::BlockedHighRisk),
            ("0x7f000001", IpClassification::BlockedHighRisk),
            ("::ffff:169.254.169.254", IpClassification::BlockedHighRisk),
            ("::ffff:192.168.1.50", IpClassification::PrivateNetwork),
            ("10.0.0.1", IpClassification::PrivateNetwork),
            ("172.16.0.1", IpClassification::PrivateNetwork),
            ("192.168.1.1", IpClassification::PrivateNetwork),
            ("100.64.0.1", IpClassification::PrivateNetwork),
            ("0300.0250.0.1", IpClassification::PrivateNetwork),
            ("fc00::1", IpClassification::PrivateNetwork),
            ("8.8.8.8", IpClassification::Public),
            ("2001:4860:4860::8888", IpClassification::Public),
        ];
        for (raw, expected) in vectors {
            assert_eq!(classify_ip_str(raw).unwrap(), expected, "vector {raw}");
        }
    }

    #[test]
    fn resolve_and_pin_host_handles_ipv6_literals_without_dns() {
        let loopback_v6 = validate_url_syntax("http://[::1]:8080/sync").unwrap();
        assert!(resolve_and_pin_host(&loopback_v6, false).unwrap_err().contains("BLOCKED_HIGH_RISK"));
        let ula_v6 = validate_url_syntax("https://[fc00::1]:8443/webdav").unwrap();
        assert!(resolve_and_pin_host(&ula_v6, false).unwrap_err().contains("PRIVATE_NETWORK_CONFIRM_REQUIRED"));
        let (host, addr) = resolve_and_pin_host(&ula_v6, true).unwrap();
        assert_eq!(host, "fc00::1");
        assert_eq!(addr.port(), 8443);
    }

    #[test]
    fn compute_remaining_budget_enforces_total_deadline() {
        let now = Instant::now();
        let deadline = now + Duration::from_secs(30);
        assert_eq!(compute_remaining_budget(deadline, now + Duration::from_secs(10)).unwrap(), Duration::from_secs(20));
        assert!(compute_remaining_budget(deadline, deadline).unwrap_err().contains("TIMEOUT:"));
    }
}
