import { useState } from "react";

const DAYS = [
  {
    day: 1, date: "2/19 (목)", label: "인천 → 하카타",
    color: "#D94F3B", icon: "✈️", stay: "하카타 1박", booked: true,
    sections: [
      {
        title: "이동",
        items: [
          { time: "15:30", desc: "인천공항 출발 (KE8795)", type: "move",
            detail: {
              name: "인천 → 후쿠오카 (KE8795)",
              category: "교통",
              tip: "인천공항 출발 15:30 → 후쿠오카공항 도착 17:10",
              highlights: ["대한항공 KE8795", "비행시간 약 1시간 40분"],
              image: "/images/ticket_departure.jpg",
            }
          },
          { time: "17:10", desc: "후쿠오카공항 도착", type: "move" },
          { time: "17:35", desc: "입국심사 + 수하물 수령", type: "info" },
          { time: "17:40", desc: "공항 직행버스 탑승 → 하카타역", type: "move", sub: "약 20분" },
          { time: "18:05", desc: "하카타역 도착 → 숙소 이동", type: "move", sub: "도보 10분" },
          { time: "18:15", desc: "숙소 체크인 & 짐 맡기기", type: "stay",
            detail: {
              name: "하카타 숙소",
              category: "숙소",
              address: "福岡市博多区住吉 2-13-13",
              tip: "캐널시티까지 도보 3분 / 하카타역 도보 15분",
              highlights: ["체크인 후 짐만 맡기고 바로 출발"],
              image: "/images/day01_hakata_airbnb.jpeg",
            }
          },
        ],
      },
      {
        title: "저녁",
        items: [
          { time: "18:25", desc: "캐널시티 라멘스타디움", type: "food", sub: "도보 3분",
            detail: {
              name: "캐널시티 라멘스타디움",
              category: "식사",
              address: "福岡市博多区住吉1-2 キャナルシティ博多 5F",
              hours: "11:00~23:00 (연중무휴)",
              price: "~1,000엔",
              tip: "전국 유명 라멘 8개 점포가 모여있는 푸드코트 형태",
              highlights: ["후쿠오카 돈코츠 라멘 추천", "줄이 짧은 곳 골라도 다 맛있음"],
              image: "/images/ramen_stadium.jpg",
            }
          },
          { time: "19:05", desc: "나카스 강변 산책", type: "spot", sub: "도보 10분",
            detail: {
              name: "나카스 강변 (中洲)",
              category: "관광",
              address: "福岡市博多区中洲",
              tip: "나카스 네온사인이 강물에 비치는 야경이 포인트",
              highlights: ["후쿠오카 대표 야경 스팟", "강변 따라 걷기만 해도 분위기 좋음"],
              image: "/images/nakasu_river.jpeg",
            }
          },
          { time: "19:35", desc: "돈키호테 나카스점 (Gate's 2F)", type: "shop",
            detail: {
              name: "돈키호테 나카스 Gate's점",
              category: "쇼핑",
              address: "福岡市博多区中洲3-7-24 Gate's 2F",
              hours: "24시간 영업",
              tip: "면세 카운터 있음 (여권 필수)",
              highlights: ["과자·화장품·의약품 면세 가능", "쿠라스시와 같은 건물"],
              image: "/images/donki.jpg",
            }
          },
          { time: "20:20", desc: "쿠라스시 나카스점 (같은 건물 3F)", type: "food",
            detail: {
              name: "쿠라스시 (くら寿司) 나카스점",
              category: "식사",
              address: "福岡市博多区中洲3-7-24 Gate's 3F",
              hours: "11:00~23:00",
              price: "1인 1,500~2,500엔",
              tip: "회전초밥 체인, 터치패널 주문이라 일본어 몰라도 OK",
              highlights: ["5접시마다 가챠폰 게임 가능", "사이드 메뉴(우동·튀김)도 추천"],
              image: "/images/kura.jpg",
            }
          },
          { time: "21:10", desc: "패밀리마트 맥주 구매", type: "shop" },
          { time: "21:20", desc: "숙소 도착 & 마무리", type: "stay" },
        ],
      },
    ],
    notes: "숙소(스미요시)↔캐널시티 도보 3분 / 돈키호테·쿠라스시 같은 건물(Gate's)",
  },
  {
    day: 2, date: "2/20 (금)", label: "하카타 → 구마모토",
    color: "#D97B2B", icon: "🚄", stay: "구마모토 1박", booked: false,
    sections: [
      {
        title: "오전 · 이동",
        items: [
          { time: "10:00", desc: "스미요시 숙소 체크아웃", type: "stay" },
          { time: "10:15", desc: "하카타역으로 이동", type: "move", sub: "도보 15분" },
          { time: "10:30", desc: "JR 북큐슈 5일권 수령 & 개시", type: "info",
            detail: {
              name: "JR 북큐슈 5일권",
              category: "교통",
              price: "17,000엔 / 인 (Klook 예매완료)",
              tip: "하카타역 JR 미도리노마도구치(みどりの窓口)에서 바우처→실물 교환",
              highlights: [
                "Day2~6 커버 (2/20~2/24)",
                "신칸센 자유석 무제한 · 지정석 6회",
                "예약번호: FGY393247 (성인 2매)",
                "여권 + Klook 바우처 바코드 필요",
              ],
            }
          },
          { time: "11:00", desc: "신칸센 탑승 (하카타→구마모토)", type: "move", sub: "33분",
            detail: {
              name: "하카타 → 구마모토 신칸센",
              category: "교통",
              tip: "JR 북큐슈 5일권으로 자유석 탑승 가능 · 지정석도 6회까지 OK",
              timetable: {
                station: "하카타역",
                direction: "구마모토 방면",
                trains: [
                  { time: "10:20", name: "みずほ605", dest: "鹿児島中央", note: "구마모토 정차, 33분", picked: false },
                  { time: "10:38", name: "さくら545", dest: "鹿児島中央", note: "구마모토 정차, 33분", picked: false },
                  { time: "10:47", name: "つばめ319", dest: "熊本", note: "각역정차, 약 50분", picked: false },
                  { time: "11:28", name: "さくら547", dest: "鹿児島中央", note: "구마모토 정차, 33분", picked: true },
                  { time: "11:36", name: "つばめ321", dest: "熊本", note: "각역정차, 약 50분", picked: false },
                ],
              },
              highlights: [
                "みずほ·さくら = 빠름(33분) / つばめ = 느림(50분)",
                "⚠️ みずほ는 지정석만 가능 (자유석 없음, 지정석 횟수 차감)",
              ],
            }
          },
          { time: "11:33", desc: "구마모토역 도착", type: "move" },
          { time: "11:40", desc: "역 코인로커에 짐 보관", type: "info", sub: "400~700엔" },
          { time: "11:50", desc: "노면전차 → 시모토리 방면", type: "move", sub: "15분 · 170엔" },
        ],
      },
      {
        title: "점심 · 오후",
        items: [
          { time: "12:10", desc: "코란테이(紅蘭亭) — 타이피엔", type: "food", sub: "구마모토식 중화 당면 스프",
            detail: {
              name: "코란테이 (紅蘭亭) 시모토리 본점",
              category: "식사",
              address: "熊本市中央区下通1-6-1",
              hours: "11:00~21:00",
              price: "~1,200엔",
              tip: "1934년 창업, 구마모토 타이피엔의 원조급 노포",
              highlights: ["타이피엔: 해산물+야채+당면 스프", "구마모토에서만 먹을 수 있는 향토 중화요리", "시모토리 아케이드 안이라 찾기 쉬움"],
            }
          },
          { time: "13:00", desc: "구마모토성 입장", type: "spot", sub: "800엔 · 천수각 6층 전망대 + AR앱",
            detail: {
              name: "구마모토성 (熊本城)",
              category: "관광",
              address: "熊本市中央区本丸1-1",
              hours: "9:00~16:30 (입장 16:00까지)",
              price: "800엔 (와쿠와쿠자 세트 850엔)",
              tip: "구마모토성 공식 앱 다운로드 → AR로 옛 모습 비교 가능",
              highlights: ["일본 3대 명성", "천수각 6층 360도 파노라마 전망", "2016 지진 후 복원 — 돌담 복구 과정 볼 수 있음", "💡 하나바타초역에서 내리면 더 가까움"],
            }
          },
          { time: "14:30", desc: "성채원(조사이엔)", type: "shop", sub: "기념품 + 카라시렌콘 간식",
            detail: {
              name: "사쿠라노바바 조사이엔 (桜の馬場 城彩苑)",
              category: "쇼핑 · 간식",
              address: "熊本市中央区二の丸1-1-1",
              hours: "9:00~17:30 (점포별 상이)",
              tip: "구마모토성 바로 아래, 에도시대 성마을 재현 거리",
              highlights: ["카라시렌콘 간식 꼭 먹어보기", "구마모토 기념품 원스톱 쇼핑", "관광안내소도 있어서 지도·정보 수집 가능"],
            }
          },
          { time: "15:00", desc: "노면전차 → 스이젠지", type: "move", sub: "20분 · 170엔" },
          { time: "15:25", desc: "스이젠지 조주엔", type: "spot", sub: "400엔 · 후지산 축소판 정원",
            detail: {
              name: "스이젠지 조주엔 (水前寺成趣園)",
              category: "관광",
              address: "熊本市中央区水前寺公園8-1",
              hours: "8:30~17:00",
              price: "400엔",
              tip: "도카이도 53경을 축소 재현한 일본 전통 정원",
              highlights: ["후지산 모양 언덕이 포토스팟", "연못 한바퀴 산책 약 30~40분", "구마모토성과 함께 2대 관광지"],
            }
          },
          { time: "16:05", desc: "노면전차 → 구마모토역 복귀", type: "move", sub: "20분" },
        ],
      },
      {
        title: "저녁",
        items: [
          { time: "16:35", desc: "역에서 짐 회수 → 호텔 체크인", type: "stay" },
          { time: "17:00", desc: "호텔에서 잠깐 휴식", type: "info" },
          { time: "18:00", desc: "스가노야 긴자도리점 — 말고기 코스", type: "food", sub: "코스 ~5,000엔 · 전일 예약 필수!",
            detail: {
              name: "스가노야 긴자도리점 (菅乃屋 銀座通り店)",
              category: "식사",
              address: "熊本市中央区下通1-9-1 ダイワロイネットホテル 2F",
              hours: "11:30~14:00 / 17:00~20:30",
              price: "코스 5,000~8,000엔",
              tip: "구마모토 바사시의 대명사! 자사 목장 직송 말고기",
              highlights: ["코스: 바사시 모둠 → 구이 → 말고기 초밥 → 디저트", "희소 부위도 맛볼 수 있음", "⚠️ 코스는 전일 예약 필수!", "온라인 예약 가능 (핫페퍼/구루나비)"],
            }
          },
          { time: "19:30", desc: "시모토리 야간 산책", type: "spot",
            detail: {
              name: "시모토리 · 신시가이 아케이드",
              category: "관광",
              address: "熊本市中央区下通 / 新市街",
              tip: "구마모토 최대 번화가, 지붕 있는 아케이드라 비와도 OK",
              highlights: ["다양한 카페·숍·이자카야 밀집", "밤에도 안전하고 활기찬 거리"],
            }
          },
          { time: "20:00", desc: "편의점 맥주 → 호텔 복귀", type: "stay" },
        ],
      },
    ],
    notes: "교통: 노면전차 170엔×3~4회 ≈ 700엔 / 입장료: 성 800엔 + 정원 400엔 = 1,200엔",
  },
  {
    day: 3, date: "2/21 (토)", label: "아소산 당일치기",
    color: "#B8912A", icon: "🌋", stay: "구마모토 1박", booked: false,
    sections: [
      {
        title: "오전 · 이동",
        items: [
          { time: "10:30", desc: "구마모토역 출발 (JR 호히본선)", type: "move", sub: "JR패스 이용 · 약 1시간 15분",
            detail: {
              name: "구마모토 → 아소 (JR 호히본선)",
              category: "교통",
              tip: "JR 북큐슈 5일권 커버 · 특급 이용 시 지정석 횟수 차감",
              timetable: {
                station: "구마모토역",
                direction: "아소 방면 (호히본선)",
                trains: [
                  { time: "09:09", name: "특급 あそぼーい!", dest: "아소·별부", note: "약 1시간 15분", picked: true },
                  { time: "10:30", name: "보통열차", dest: "미야지 경유 아소", note: "약 1시간 40분", picked: false },
                  { time: "12:19", name: "보통열차", dest: "미야지 경유 아소", note: "약 1시간 40분", picked: false },
                ],
              },
              highlights: [
                "특급 あそぼーい!(아소보이): 토·일·공휴일 운행 관광열차",
                "보통열차는 히고오즈(肥後大津)에서 환승 필요할 수 있음",
                "⚠️ 열차 편수가 적으니 시간 반드시 확인!",
              ],
            }
          },
          { time: "11:45", desc: "아소역 도착", type: "move" },
        ],
      },
      {
        title: "점심",
        items: [
          { time: "12:00", desc: "이마킨 식당 — 아카규동", type: "food", sub: "아카우시 덮밥 1,780엔",
            detail: {
              name: "이마킨 식당 (いまきん食堂)",
              category: "식사",
              address: "阿蘇市内牧290",
              hours: "11:00~15:00 (수요일 휴무)",
              price: "1,780엔",
              tip: "100년 넘은 노포, 토요일이라 일찍 갈수록 좋음",
              highlights: ["레어 구이 아카우시 + 온천 달걀 + 특제 소스", "아소 대표 맛집 — 줄서는 곳이니 일찍 도착 추천"],
            }
          },
        ],
      },
      {
        title: "오후 · 아소산 관광",
        items: [
          { time: "13:00", desc: "아소역 앞 버스 탑승 → 아소산", type: "move", sub: "약 35분 · ~600엔" },
          { time: "13:30", desc: "쿠사센리 초원 + 나카다케 화구 전망", type: "spot", sub: "약 1시간",
            detail: {
              name: "쿠사센리 · 나카다케 화구",
              category: "관광",
              address: "아소산 정상부",
              tip: "화산활동에 따라 화구 접근 제한 가능 — 당일 확인 필수",
              highlights: ["쿠사센리 초원 산책 + 나카다케 활화산 전망", "⚠️ 화구 제한 시 Plan B: 승마체험 + 아소 화산박물관", "🌡 2월 아소산은 0~5°C → 방한 준비 필수!", "화구 상황 확인: aso.ne.jp/~volcano/"],
            }
          },
          { time: "14:30", desc: "버스로 하산", type: "move" },
        ],
      },
      {
        title: "늦은 오후 · 아소 신사",
        items: [
          { time: "15:00", desc: "아소 신사 참배", type: "spot", sub: "약 45분",
            detail: {
              name: "아소 신사 (阿蘇神社)",
              category: "관광",
              address: "아소시 이치노미야마치",
              tip: "일본 전국 약 450개 아소 신사의 총본사",
              highlights: ["2016 지진 후 복원된 누문이 볼거리", "몬젠마치 상점가와 이어져 있음"],
            }
          },
          { time: "15:15", desc: "몬젠마치 상점가 산책", type: "shop",
            detail: {
              name: "몬젠마치 상점가",
              category: "쇼핑 · 간식",
              address: "아소 신사 앞 상점가",
              tip: "아소 신사 바로 앞 먹거리·기념품 거리",
              highlights: ["ASOMILK 소프트아이스크림 꼭 먹어보기 (아베목장 우유)", "아소 특산품·간식 구경하기 좋은 곳"],
            }
          },
          { time: "16:00", desc: "JR로 구마모토 복귀", type: "move", sub: "약 1시간 15분 · JR패스",
            detail: {
              name: "아소 → 구마모토 (JR 호히본선)",
              category: "교통",
              tip: "JR 북큐슈 5일권 커버 · 놓치면 다음 열차까지 대기 길어짐",
              timetable: {
                station: "아소역",
                direction: "구마모토 방면 (호히본선)",
                trains: [
                  { time: "14:28", name: "보통열차", dest: "구마모토", note: "약 1시간 40분", picked: false },
                  { time: "15:46", name: "특급 あそぼーい!", dest: "구마모토", note: "약 1시간 15분 → 17:01착", picked: true },
                  { time: "16:28", name: "보통열차", dest: "구마모토", note: "약 1시간 40분 → 18:08착", picked: false },
                  { time: "17:39", name: "보통열차", dest: "구마모토", note: "약 1시간 40분", picked: false },
                ],
              },
              highlights: [
                "あそぼーい! 15:46발이 가장 빠름 (17:01 도착)",
                "놓칠 경우 16:28 보통열차 (18:08 도착)",
                "⚠️ 열차 편수 적음 — 아소 신사에서 시간 조절 필요!",
              ],
            }
          },
        ],
      },
      {
        title: "저녁",
        items: [
          { time: "17:15", desc: "구마모토역 도착 → 숙소 휴식", type: "stay" },
          { time: "18:30", desc: "시모토리로 출발", type: "move" },
          { time: "19:00", desc: "야츠다 — 숯불 야키토리", type: "food", sub: "1인 ~3,000엔",
            detail: {
              name: "야츠다 (炭火焼 やつ田)",
              category: "식사",
              address: "熊本市中央区下通 골목 안",
              hours: "~새벽 1:00",
              price: "1인 2,000~3,000엔",
              tip: "시모토리 골목 안 숯불 야키토리 이자카야",
              highlights: ["당일 도축 조비키도리(朝びき鶏) + 자가제 타레", "사이드: 바사시, 호르몬 니코미 등 구마모토 안주", "늦게까지 영업해서 여유롭게 즐기기 좋음"],
            }
          },
          { time: "20:30", desc: "편의점 들러 숙소 복귀", type: "stay" },
        ],
      },
    ],
    notes: "교통: JR패스 커버 + 아소 버스 ~600엔 / 점심 1,780엔 + 간식 ~500엔 + 저녁 ~3,000엔 ≈ 총 5,880엔 / 2월 아소산 0~5°C 방한 필수!",
  },
  {
    day: 4, date: "2/22 (일)", label: "구마모토 → 유후인",
    color: "#3E8E5B", icon: "♨️", stay: "유후인 1박", booked: false,
    sections: [
      {
        title: "종일",
        items: [
          { time: "오전", desc: "구마모토 출발", type: "move" },
          { time: "~점심", desc: "유후인 도착 & 체크인", type: "stay" },
          { time: "오후", desc: "유후인 유노쓰보 거리 산책", type: "shop" },
          { time: "저녁", desc: "료칸 온천 & 카이세키 요리", type: "food" },
        ],
      },
    ],
    notes: "구마모토 → 유후인 (JR 쿠루메 환승, 5일권 커버) / 료칸 후보: 센도·바이엔·겟토안",
  },
  {
    day: 5, date: "2/23 (월)", label: "유후인 → 하카타",
    color: "#3A7DB5", icon: "🛍️", stay: "하카타 1박", booked: false,
    sections: [
      {
        title: "종일",
        items: [
          { time: "오전", desc: "킨린코 호수 산책", type: "spot" },
          { time: "~점심", desc: "유후인 출발 → 하카타", type: "move" },
          { time: "오후", desc: "캐널시티 / 텐진 쇼핑", type: "shop" },
          { time: "저녁", desc: "나카스 포장마차 야타이 체험", type: "food" },
        ],
      },
    ],
    notes: "유후인→하카타 별도 티켓 구매 (~4,800엔) / 유후인노모리 특급 추천",
  },
  {
    day: 6, date: "2/24 (화)", label: "하카타 → 인천",
    color: "#7161A5", icon: "✈️", stay: "귀국", booked: true,
    sections: [
      {
        title: "오전",
        items: [
          { time: "오전", desc: "면세점 쇼핑 / 공항 이동", type: "shop" },
          { time: "10:30", desc: "후쿠오카공항 출발 (KE788)", type: "move" },
          { time: "12:00", desc: "인천공항 도착", type: "move" },
        ],
      },
    ],
    notes: "대한항공 KE788 · 수하물 1pc",
  },
];

const TYPE_CONFIG = {
  food: { emoji: "🍽", bg: "#FFF3EC", border: "#FDDCC8", text: "#C75D20" },
  spot: { emoji: "📍", bg: "#EEF6FF", border: "#C8DFF5", text: "#2B6CB0" },
  shop: { emoji: "🛍", bg: "#F3F0FF", border: "#D5CCF5", text: "#6B46C1" },
  move: { emoji: "→",  bg: "#F5F5F4", border: "#E0DFDC", text: "#6B6B67" },
  stay: { emoji: "🏨", bg: "#F0FAF4", border: "#C6F0D5", text: "#2A7D4F" },
  info: { emoji: "💡", bg: "#FFFDE8", border: "#F0EAAC", text: "#8A7E22" },
};

const CATEGORY_COLORS = {
  "식사": { bg: "#FFF3EC", color: "#C75D20", border: "#FDDCC8" },
  "관광": { bg: "#EEF6FF", color: "#2B6CB0", border: "#C8DFF5" },
  "쇼핑": { bg: "#F3F0FF", color: "#6B46C1", border: "#D5CCF5" },
  "쇼핑 · 간식": { bg: "#F3F0FF", color: "#6B46C1", border: "#D5CCF5" },
  "숙소": { bg: "#F0FAF4", color: "#2A7D4F", border: "#C6F0D5" },
  "교통": { bg: "#FFFDE8", color: "#8A7E22", border: "#F0EAAC" },
};

function DocumentDialog({ onClose }) {
  const [tab, setTab] = useState(0);
  const tabs = [
    { label: "✈️ 항공권", image: "/images/ticket_departure.jpg", caption: "KE8795 인천→후쿠오카 / KE788 후쿠오카→인천" },
    { label: "🚄 JR패스", image: "/images/jrpass.jpg", caption: "JR 북큐슈 5일권 · 예약번호: FGY393247 (성인 2매)" },
  ];
  const current = tabs[tab];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "420px", maxHeight: "85vh",
          background: "#fff", borderRadius: "18px",
          overflow: "hidden", animation: "slideUp 0.25s ease",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Dialog header */}
        <div style={{
          padding: "16px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1a1a1a" }}>
            📄 여행 서류
          </h3>
          <button onClick={onClose} style={{
            border: "none", background: "#F2F1ED", borderRadius: "50%",
            width: "28px", height: "28px", cursor: "pointer",
            fontSize: "14px", color: "#999", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit",
          }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: "6px", padding: "14px 20px 0",
        }}>
          {tabs.map((t, i) => (
            <button key={i} onClick={() => setTab(i)} style={{
              flex: 1, padding: "9px 0", border: "none", borderRadius: "10px",
              background: tab === i ? "#1a1a1a" : "#F2F1ED",
              color: tab === i ? "#fff" : "#777",
              fontSize: "12px", fontWeight: tab === i ? 700 : 500,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 20px" }}>
          {/* Caption */}
          <p style={{
            margin: "0 0 12px", fontSize: "11px", color: "#888",
            lineHeight: 1.5, textAlign: "center",
          }}>
            {current.caption}
          </p>

          {/* Image or placeholder */}
          {current.image ? (
            <div style={{
              borderRadius: "12px", overflow: "hidden",
              border: "1px solid #EEECE6",
              background: "#F9F9F7",
              aspectRatio: "595 / 842",
              width: "100%",
            }}>
              <img
                src={current.image}
                alt={current.label}
                style={{
                  width: "100%", height: "100%", display: "block",
                  objectFit: "contain",
                }}
              />
            </div>
          ) : (
            <div style={{
              borderRadius: "12px", border: "2px dashed #DDD8CB",
              padding: "40px 20px", textAlign: "center",
              background: "#FDFCF8",
            }}>
              <p style={{ margin: 0, fontSize: "32px" }}>🎫</p>
              <p style={{
                margin: "10px 0 4px", fontSize: "13px", fontWeight: 600, color: "#999",
              }}>
                이미지 준비 중
              </p>
              <p style={{
                margin: 0, fontSize: "11px", color: "#bbb", lineHeight: 1.5,
              }}>
                public/images/ 폴더에<br />JR패스 이미지를 추가해주세요
              </p>
            </div>
          )}

          {/* Extra info for JR pass tab */}
          {tab === 1 && (
            <div style={{
              marginTop: "14px", padding: "14px",
              background: "#FAFAF8", borderRadius: "12px",
              border: "1px solid #EEECE6",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "13px", flexShrink: 0 }}>🎫</span>
                  <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>JR 북큐슈 5일권 (17,000엔/인)</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "13px", flexShrink: 0 }}>📅</span>
                  <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>Day2~6 커버 (2/20~2/24)</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "13px", flexShrink: 0 }}>🔢</span>
                  <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>예약번호: FGY393247 (성인 2매)</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "13px", flexShrink: 0 }}>💡</span>
                  <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>하카타역 みどりの窓口에서 바우처→실물 교환<br/>여권 + Klook 바우처 바코드 필요</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "13px", flexShrink: 0 }}>🚄</span>
                  <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>신칸센 자유석 무제한 · 지정석 6회</span>
                </div>
              </div>
            </div>
          )}

          {/* Extra info for flight tab */}
          {tab === 0 && (
            <div style={{
              marginTop: "14px", padding: "14px",
              background: "#FAFAF8", borderRadius: "12px",
              border: "1px solid #EEECE6",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "13px", flexShrink: 0 }}>✈️</span>
                  <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}><b>가는편</b> KE8795 · 인천 15:30 → 후쿠오카 17:10</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "13px", flexShrink: 0 }}>✈️</span>
                  <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}><b>오는편</b> KE788 · 후쿠오카 10:30 → 인천 12:00</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "13px", flexShrink: 0 }}>🧳</span>
                  <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>수하물 1pc 포함</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailDialog({ detail, onClose, dayColor }) {
  if (!detail) return null;
  const cat = CATEGORY_COLORS[detail.category] || { bg: "#f5f5f5", color: "#555", border: "#ddd" };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "16px",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(40px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "420px", maxHeight: "80vh",
          background: "#fff", borderRadius: "20px 20px 16px 16px",
          overflow: "hidden", animation: "slideUp 0.25s ease",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Handle bar */}
        <div style={{
          display: "flex", justifyContent: "center", padding: "10px 0 4px",
        }}>
          <div style={{
            width: "36px", height: "4px", borderRadius: "2px", background: "#ddd",
          }} />
        </div>

        {/* Image - top, outside scroll area for full bleed */}
        {detail.image && (
          <div style={{ flexShrink: 0, overflow: "hidden" }}>
            <img
              src={detail.image}
              alt={detail.name}
              style={{
                width: "100%", display: "block",
                maxHeight: "200px", objectFit: "cover",
              }}
            />
          </div>
        )}

        {/* Content */}
        <div style={{ overflowY: "auto", padding: "8px 20px 20px" }}>
          {/* Category badge + Name */}
          <div style={{ marginBottom: "14px" }}>
            <span style={{
              display: "inline-block", padding: "3px 10px", borderRadius: "20px",
              fontSize: "10px", fontWeight: 700,
              background: cat.bg, color: cat.color, border: `1px solid ${cat.border}`,
              marginBottom: "8px",
            }}>
              {detail.category}
            </span>
            <h3 style={{
              margin: 0, fontSize: "18px", fontWeight: 800,
              color: "#111", letterSpacing: "-0.3px", lineHeight: 1.3,
            }}>
              {detail.name}
            </h3>
          </div>

          {/* Info rows */}
          <div style={{
            display: "flex", flexDirection: "column", gap: "8px",
            padding: "14px", background: "#FAFAF8", borderRadius: "12px",
            border: "1px solid #EEECE6", marginBottom: "14px",
          }}>
            {detail.address && (
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "13px", flexShrink: 0, marginTop: "1px" }}>📍</span>
                <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>{detail.address}</span>
              </div>
            )}
            {detail.hours && (
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "13px", flexShrink: 0, marginTop: "1px" }}>🕐</span>
                <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>{detail.hours}</span>
              </div>
            )}
            {detail.price && (
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "13px", flexShrink: 0, marginTop: "1px" }}>💰</span>
                <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>{detail.price}</span>
              </div>
            )}
            {detail.tip && (
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "13px", flexShrink: 0, marginTop: "1px" }}>💡</span>
                <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>{detail.tip}</span>
              </div>
            )}
          </div>

          {/* Timetable */}
          {detail.timetable && (
            <div style={{ marginBottom: "14px" }}>
              <p style={{
                margin: "0 0 8px", fontSize: "11px", fontWeight: 700,
                color: "#999", letterSpacing: "0.5px",
              }}>
                🚆 {detail.timetable.station} 발차 시간표 — {detail.timetable.direction}
              </p>
              <div style={{
                borderRadius: "12px", overflow: "hidden",
                border: "1px solid #E0DFDC",
              }}>
                {/* Table header */}
                <div style={{
                  display: "flex", padding: "8px 12px",
                  background: "#F5F5F4", borderBottom: "1px solid #E0DFDC",
                  fontSize: "10px", fontWeight: 700, color: "#888", letterSpacing: "0.3px",
                }}>
                  <span style={{ width: "52px", flexShrink: 0 }}>시각</span>
                  <span style={{ flex: 1 }}>열차명</span>
                  <span style={{ flex: 1, textAlign: "right" }}>행선 / 소요</span>
                </div>
                {/* Table rows */}
                {detail.timetable.trains.map((t, i) => (
                  <div key={i} style={{
                    display: "flex", flexDirection: "column",
                    padding: t.picked ? "8px 12px 9px" : "7px 12px",
                    background: t.picked ? "linear-gradient(90deg, #FFF9E0, #FFF4CC)" : (i % 2 === 0 ? "#fff" : "#FAFAF8"),
                    borderBottom: i < detail.timetable.trains.length - 1 ? "1px solid #F0EEEA" : "none",
                    borderLeft: t.picked ? "3px solid #E6B800" : "3px solid transparent",
                  }}>
                    {t.picked && (
                      <span style={{
                        alignSelf: "flex-start",
                        fontSize: "8px", fontWeight: 800, color: "#B8860B",
                        background: "#FFF0B3", padding: "1px 6px", borderRadius: "4px",
                        letterSpacing: "0.3px", marginBottom: "5px",
                      }}>
                        탑승 예정
                      </span>
                    )}
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{
                        width: "52px", flexShrink: 0,
                        fontSize: t.picked ? "14px" : "12px",
                        fontWeight: t.picked ? 900 : 600,
                        color: t.picked ? "#8B6914" : "#555",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {t.time}
                      </span>
                      <span style={{
                        flex: 1,
                        fontSize: t.picked ? "13px" : "11px",
                        fontWeight: t.picked ? 800 : 500,
                        color: t.picked ? "#6B4F00" : "#444",
                      }}>
                        {t.name}
                      </span>
                      <span style={{
                        flex: 1, textAlign: "right",
                        fontSize: "10px",
                        fontWeight: t.picked ? 700 : 400,
                        color: t.picked ? "#8B6914" : "#999",
                        lineHeight: 1.4,
                      }}>
                        <span style={{ display: "block" }}>{t.dest}</span>
                        <span style={{ fontSize: "9px", opacity: 0.8 }}>{t.note}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Highlights */}
          {detail.highlights && detail.highlights.length > 0 && (
            <div>
              <p style={{
                margin: "0 0 8px", fontSize: "11px", fontWeight: 700,
                color: "#999", letterSpacing: "0.5px",
              }}>
                포인트
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {detail.highlights.map((h, i) => (
                  <div key={i} style={{
                    display: "flex", gap: "8px", alignItems: "flex-start",
                  }}>
                    <div style={{
                      width: "5px", height: "5px", borderRadius: "50%",
                      background: dayColor, flexShrink: 0, marginTop: "6px",
                    }} />
                    <span style={{ fontSize: "12px", color: "#444", lineHeight: 1.55 }}>
                      {h}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Close button */}
        <div style={{ padding: "0 20px 16px" }}>
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "12px", border: "none",
              borderRadius: "12px", background: "#F2F1ED",
              fontSize: "13px", fontWeight: 600, color: "#555",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TravelPlanner() {
  const [selectedDay, setSelectedDay] = useState(0);
  const [activeDetail, setActiveDetail] = useState(null);
  const [showDocs, setShowDocs] = useState(false);
  const current = DAYS[selectedDay];

  return (
    <div style={{
      width: "100%", height: "100vh", display: "flex", flexDirection: "column",
      fontFamily: "'Noto Sans KR', sans-serif", background: "#F5F4F0", overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        padding: "14px 20px", background: "#fff",
        borderBottom: "1px solid #E8E6E1",
        display: "flex", alignItems: "center", gap: "10px", flexShrink: 0,
      }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "10px",
          background: "linear-gradient(135deg, #E8594F, #D97B2B)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px",
        }}>🇯🇵</div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.5px" }}>
            후쿠오카 · 구마모토 · 유후인
          </h1>
          <p style={{ margin: 0, fontSize: "11px", color: "#999" }}>
            2026.02.19 — 02.24 · 5박 6일
          </p>
        </div>
        <button
          onClick={() => setShowDocs(true)}
          style={{
            width: "36px", height: "36px", borderRadius: "10px",
            border: "1px solid #E8E6E1", background: "#FAFAF8",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: "16px", flexShrink: 0,
            transition: "background 0.15s",
          }}
          title="여행 서류"
        >
          📄
        </button>
      </div>

      {/* Day tabs */}
      <div style={{
        display: "flex", gap: 0, padding: "0 12px",
        background: "#fff", borderBottom: "1px solid #E8E6E1",
        overflowX: "auto", flexShrink: 0,
      }}>
        {DAYS.map((day, i) => {
          const active = selectedDay === i;
          return (
            <button key={i} onClick={() => setSelectedDay(i)} style={{
              flex: "none", padding: "10px 14px", border: "none",
              background: "none", cursor: "pointer",
              borderBottom: active ? `2.5px solid ${day.color}` : "2.5px solid transparent",
              color: active ? day.color : "#aaa",
              fontWeight: active ? 700 : 400,
              fontSize: "12px", fontFamily: "inherit",
              transition: "all 0.15s", whiteSpace: "nowrap",
              opacity: active ? 1 : 0.7,
            }}>
              <span style={{ fontSize: "14px", marginRight: "3px" }}>{day.icon}</span>
              D{day.day}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 32px" }}>

        {/* Day title card */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          marginBottom: "16px", padding: "14px 16px",
          background: "#fff", borderRadius: "14px", border: "1px solid #E8E6E1",
        }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "12px",
            background: current.color, display: "flex",
            alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: "18px", flexShrink: 0,
          }}>
            {current.icon}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.3px" }}>
              {current.label}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#999" }}>
              {current.date} · {current.stay}
            </p>
          </div>
          <span style={{
            padding: "4px 10px", borderRadius: "20px",
            fontSize: "10px", fontWeight: 700,
            background: current.booked ? `${current.color}15` : "#f5f0e8",
            color: current.booked ? current.color : "#b5a276",
          }}>
            {current.booked ? "✓ 예약완료" : "미예약"}
          </span>
        </div>

        {/* Sections */}
        {current.sections.map((section, si) => (
          <div key={si} style={{ marginBottom: "12px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "0 4px", marginBottom: "8px",
            }}>
              <div style={{
                width: "6px", height: "6px", borderRadius: "50%", background: current.color,
              }} />
              <span style={{
                fontSize: "11px", fontWeight: 700, color: current.color, letterSpacing: "0.5px",
              }}>
                {section.title}
              </span>
              <div style={{ flex: 1, height: "1px", background: `${current.color}20` }} />
            </div>

            <div style={{
              background: "#fff", borderRadius: "14px",
              border: "1px solid #E8E6E1", overflow: "hidden",
            }}>
              {section.items.map((item, ii) => {
                const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
                const isLast = ii === section.items.length - 1;
                const hasDetail = !!item.detail;
                return (
                  <div
                    key={ii}
                    onClick={hasDetail ? () => setActiveDetail(item.detail) : undefined}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "10px",
                      padding: "10px 14px",
                      borderBottom: isLast ? "none" : "1px solid #F2F1ED",
                      background: "transparent",
                      cursor: hasDetail ? "pointer" : "default",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => { if (hasDetail) e.currentTarget.style.background = "#FAFAF8"; }}
                    onMouseLeave={(e) => { if (hasDetail) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ width: "44px", flexShrink: 0, textAlign: "right", paddingTop: "2px" }}>
                      <span style={{
                        fontSize: "12px", fontWeight: 700, color: "#555",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {item.time}
                      </span>
                    </div>
                    <div style={{
                      width: "22px", height: "22px", borderRadius: "6px",
                      background: cfg.bg, border: `1px solid ${cfg.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "11px", flexShrink: 0, marginTop: "1px",
                    }}>
                      {cfg.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <p style={{
                          margin: 0, fontSize: "13px", fontWeight: 500, color: "#222", lineHeight: 1.45,
                        }}>
                          {item.desc}
                        </p>
                        {hasDetail && (
                          <span style={{
                            fontSize: "10px", color: "#bbb", flexShrink: 0,
                          }}>›</span>
                        )}
                      </div>
                      {item.sub && (
                        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#999", lineHeight: 1.3 }}>
                          {item.sub}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Notes */}
        {current.notes && (
          <div style={{
            marginTop: "4px", padding: "11px 14px",
            background: "#FDFCF8", borderRadius: "12px", border: "1px dashed #DDD8CB",
          }}>
            <p style={{ margin: 0, fontSize: "11px", color: "#888", lineHeight: 1.6 }}>
              📌 {current.notes}
            </p>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <DetailDialog
        detail={activeDetail}
        onClose={() => setActiveDetail(null)}
        dayColor={current.color}
      />

      {/* Document Dialog */}
      {showDocs && <DocumentDialog onClose={() => setShowDocs(false)} />}
    </div>
  );
}
