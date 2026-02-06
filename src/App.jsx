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

const DAY_INFO = {
  1: {
    meals: {
      dinner: [
        { name: "캐널시티 라멘스타디움", time: "18:25", price: "~1,000엔", mapQuery: "キャナルシティ博多 ラーメンスタジアム", note: "전국 유명 라멘 8개 점포 푸드코트" },
        { name: "쿠라스시 나카스점", time: "20:20", price: "1인 1,500~2,500엔", mapQuery: "くら寿司 中洲店 福岡", note: "회전초밥, 터치패널 주문" },
      ],
    },
    stay: { name: "하카타 에어비앤비", address: "福岡市博多区住吉 2-13-13", mapQuery: "福岡市博多区住吉 2-13-13", checkin: "18:15", checkout: "Day2 10:00", note: "캐널시티 도보 3분 / 하카타역 도보 15분" },
  },
  2: {
    meals: {
      lunch: [
        { name: "코란테이 (紅蘭亭)", time: "12:10", price: "~1,200엔", mapQuery: "紅蘭亭 下通本店 熊本", note: "타이피엔 — 구마모토 향토 중화 당면 스프" },
      ],
      dinner: [
        { name: "스가노야 긴자도리점", time: "18:00", price: "코스 5,000~8,000엔", mapQuery: "菅乃屋 銀座通り店 熊本", note: "바사시(말고기) 코스 · ⚠️ 전일 예약 필수!" },
      ],
    },
    stay: { name: "구마모토 호텔", address: "구마모토역 근처", mapQuery: "熊本駅 ホテル", checkin: "16:35", checkout: "Day3 아침", note: "구마모토역에서 도보 이동" },
  },
  3: {
    meals: {
      lunch: [
        { name: "이마킨 식당 — 아카규동", time: "12:00", price: "1,780엔", mapQuery: "いまきん食堂 阿蘇", note: "100년 노포, 아카우시 덮밥 · 줄서는 곳" },
      ],
      dinner: [
        { name: "야츠다 — 숯불 야키토리", time: "19:00", price: "1인 ~3,000엔", mapQuery: "炭火焼やつ田 熊本 下通", note: "당일 도축 조비키도리 + 구마모토 안주" },
      ],
    },
    stay: { name: "구마모토 호텔", address: "구마모토역 근처", mapQuery: "熊本駅 ホテル", checkin: "17:15 (귀환)", checkout: "Day4 오전", note: "Day2와 동일 숙소" },
  },
  4: {
    meals: {
      dinner: [
        { name: "료칸 카이세키 요리", time: "저녁", price: "숙박 포함", mapQuery: "由布院 旅館", note: "료칸 내 일본 전통 코스 요리" },
      ],
    },
    stay: { name: "유후인 료칸", address: "유후인 온천 지역", mapQuery: "由布院温泉 旅館", checkin: "점심경", checkout: "Day5 오전", note: "료칸 후보: 센도·바이엔·겟토안 / 온천 포함" },
  },
  5: {
    meals: {
      dinner: [
        { name: "나카스 포장마차 야타이", time: "저녁", price: "1인 2,000~3,000엔", mapQuery: "中洲屋台 福岡", note: "강변 포장마차 — 라멘, 교자, 야키토리" },
      ],
    },
    stay: { name: "하카타 숙소", address: "하카타역 인근", mapQuery: "博多駅 ホテル", checkin: "오후", checkout: "Day6 오전", note: "캐널시티·텐진 접근 용이한 곳" },
  },
  6: {
    meals: {},
    stay: { name: "귀국", address: "후쿠오카 공항", mapQuery: "福岡空港 国際線", checkin: "-", checkout: "10:30 출발", note: "KE788 후쿠오카 10:30 → 인천 12:00" },
  },
};

function DayInfoDialog({ dayNum, tab, onClose, color }) {
  const [activeTab, setActiveTab] = useState(tab);
  const info = DAY_INFO[dayNum];
  if (!info) return null;

  const meals = info.meals || {};
  const mealSections = [];
  if (meals.breakfast) mealSections.push({ label: "조식", items: meals.breakfast });
  if (meals.lunch) mealSections.push({ label: "점심", items: meals.lunch });
  if (meals.dinner) mealSections.push({ label: "석식", items: meals.dinner });

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
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "420px", maxHeight: "75vh",
          background: "#fff", borderRadius: "20px 20px 16px 16px",
          overflow: "hidden", animation: "slideUp 0.25s ease",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header with tabs */}
        <div style={{
          display: "flex", borderBottom: "1px solid #EEECE6", flexShrink: 0,
        }}>
          {["meals", "stay"].map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              flex: 1, padding: "14px 0", border: "none", background: "none",
              borderBottom: activeTab === t ? `2.5px solid ${color}` : "2.5px solid transparent",
              color: activeTab === t ? color : "#aaa",
              fontSize: "13px", fontWeight: activeTab === t ? 700 : 400,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
            }}>
              {t === "meals" ? "🍽 식사" : "🏨 숙소"}
            </button>
          ))}
          <button onClick={onClose} style={{
            position: "absolute", right: "24px", marginTop: "8px",
            border: "none", background: "#F2F1ED", borderRadius: "50%",
            width: "28px", height: "28px", cursor: "pointer",
            fontSize: "14px", color: "#999", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit",
          }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px" }}>

          {/* 식사 탭 */}
          {activeTab === "meals" && (
            <>
              {mealSections.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "#bbb", fontSize: "13px" }}>
                  이 날은 식사 정보가 없습니다
                </div>
              ) : (
                mealSections.map((section, si) => (
                  <div key={si} style={{ marginBottom: "16px" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px",
                    }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: "20px",
                        fontSize: "11px", fontWeight: 700,
                        background: `${color}15`, color: color,
                      }}>
                        {section.label}
                      </span>
                      <div style={{ flex: 1, height: "1px", background: "#EEECE6" }} />
                    </div>
                    {section.items.map((meal, mi) => (
                      <div key={mi} style={{
                        padding: "12px 14px", background: "#FAFAF8",
                        borderRadius: "12px", border: "1px solid #EEECE6",
                        marginBottom: "8px",
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#111" }}>{meal.name}</p>
                            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#666", lineHeight: 1.5 }}>{meal.note}</p>
                          </div>
                          <MapButton query={meal.mapQuery} />
                        </div>
                        <div style={{ display: "flex", gap: "12px", marginTop: "8px", fontSize: "10px", color: "#888" }}>
                          <span>🕐 {meal.time}</span>
                          <span>💰 {meal.price}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </>
          )}

          {/* 숙소 탭 */}
          {activeTab === "stay" && info.stay && (
            <div style={{
              padding: "16px", background: "#FAFAF8",
              borderRadius: "12px", border: "1px solid #EEECE6",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "10px" }}>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#111" }}>{info.stay.name}</p>
                <MapButton query={info.stay.mapQuery} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "13px", flexShrink: 0 }}>📍</span>
                  <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>{info.stay.address}</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "13px", flexShrink: 0 }}>🔑</span>
                  <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>체크인 {info.stay.checkin} / 체크아웃 {info.stay.checkout}</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "13px", flexShrink: 0 }}>💡</span>
                  <span style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>{info.stay.note}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

const GUIDE_DATA = [
  {
    region: "하카타",
    color: "#E8594F",
    chips: ["전체", "쇼핑", "먹거리", "구경거리"],
    items: [
      { chip: "쇼핑", name: "캐널시티 하카타", sub: "キャナルシティ博多", mapQuery: "キャナルシティ博多", desc: "복합 쇼핑몰. 쇼핑, 영화, 라멘스타디움까지", details: ["라멘스타디움 5층 — 전국 유명 라멘 8개점 집결", "무인양품, 유니클로, ABC마트 등", "매일 분수 쇼 (음악+조명)"], tip: "Day1 도착 후 저녁 겸 방문 추천" },
      { chip: "쇼핑", name: "돈키호테 나카스점", sub: "ドン・キホーテ 中洲店", mapQuery: "ドンキホーテ 中洲店 福岡", desc: "24시간 할인 잡화점. 면세 가능 (여권 필수)", details: ["의약품, 화장품, 위스키, 과자, 전자기기", "면세 카운터 별도 운영", "나카스 야타이 가기 전 들르기 좋음"], tip: "Day1 야타이 전 or Day6 새벽 쇼핑" },
      { chip: "쇼핑", name: "텐진 지하상가", sub: "天神地下街", mapQuery: "天神地下街 福岡", desc: "150개 이상 매장이 모인 대형 지하 쇼핑가", details: ["패션, 잡화, 카페, 드럭스토어", "비 올 때 쇼핑 동선으로 최적", "니시테츠 텐진역 직결"], tip: "Day6 오전 공항 가기 전 활용" },
      { chip: "먹거리", name: "하카타 라멘", sub: "博多ラーメン", mapQuery: "一蘭 中洲店 福岡", desc: "돈코츠 라멘의 본고장. 이치란, 잇푸도 등", details: ["이치란 나카스점 — 24시간, 칸막이석", "잇푸도 본점 — 하카타역 근처", "면 굵기·국물 농도 주문 가능"], tip: "캐널시티 라멘스타디움에서 비교 체험" },
      { chip: "먹거리", name: "나카스 야타이 (포장마차)", sub: "中洲屋台", mapQuery: "中洲屋台 福岡", desc: "나카가와 강변 포장마차 거리. 라멘, 꼬치 등", details: ["저녁 6시경부터 오픈", "한 곳당 8~10석 소규모", "라멘, 교자, 오뎅, 야키토리 등"], tip: "Day1 저녁 or Day6 전날 밤" },
      { chip: "먹거리", name: "쿠라스시 나카스점", sub: "くら寿司", mapQuery: "くら寿司 中洲店 福岡", desc: "가성비 회전초밥. 1접시 115엔~", details: ["터치패널 주문", "비쿠라 가챠 게임 (5접시마다)"], tip: "Day1 가볍게 초밥 저녁으로" },
      { chip: "구경거리", name: "나카스 강변 야경", sub: "中洲リバーサイド", mapQuery: "中洲 中央通り 福岡", desc: "나카가와 강변 네온 야경", details: ["야타이 포장마차 불빛 + 강 반영", "나카스~텐진 구간 산책 추천"], tip: "야타이 방문 전후 산책" },
    ],
  },
  {
    region: "구마모토",
    color: "#2A7D4F",
    chips: ["전체", "구경거리", "먹거리", "굿즈", "쇼핑스팟"],
    items: [
      { chip: "구경거리", name: "쿠마몬 스퀘어", sub: "くまモンスクエア", mapQuery: "くまモンスクエア 熊本", desc: "쓰루야 백화점 내 무료 체험 공간", details: ["360도 스테이지, 포토스팟, AR 게임", "BAZAAR — 100종류 이상 굿즈, 한정 레어 아이템", "카페: 데코폰 주스, 구마모토산 과일 디저트"], schedule: "공연 11:30 / 14:00 (매일) + 16:30 (주말)", tip: "Day2 시모토리 동선에서 쓰루야 백화점과 함께" },
      { chip: "구경거리", name: "쿠마몬 빌리지", sub: "くまモンビレッジ", mapQuery: "くまモンビレッジ サクラマチ熊本", desc: "사쿠라마치 쇼핑몰 2층 굿즈 전문매장", details: ["스퀘어보다 상품 종류 더 다양", "5,000엔 이상 면세 가능", "5층 옥상 자이언트 쿠마몬 + 일본식 정원", "같은 건물: 지브리숍, 가차숍, 버스터미널"], tip: "Day3 저녁 야츠다 가기 전 잠깐 들르기" },
      { chip: "구경거리", name: "원피스 루피 동상", sub: "ルフィ像", mapQuery: "ルフィ像 熊本県庁", desc: "구마모토현청 앞 부흥 프로젝트 동상", details: ["오다 에이이치로 출신지 → 2016년 대지진 부흥", "시내: 루피(현청), 쵸파(동식물원)", "동상 옆 QR코드 → 캐릭터 대사 재생"], tip: "Day2 스이젠지 공원 가는 길에 인증샷" },
      { chip: "구경거리", name: "가미토리 쿠마몬 조형물", sub: "上通りアーケード", mapQuery: "上通りアーケード 熊本", desc: "가미토리 상점가 중심부 대형 조형물", details: ["시모토리와 연결", "현대미술관·전통공예관 인접"], tip: "시모토리보다 한적, 여유롭게 인증샷" },
      { chip: "먹거리", name: "쿠리센리 (栗千里)", sub: null, mapQuery: "鶴屋百貨店 熊本", desc: "구마모토산 밤 구운 몽블랑. 전국 향토 간식 1위", details: ["개별포장 선물용 최적", "5개입 729엔 / 8개입 1,166엔"], tip: "쓰루야 백화점, JR구마모토역, 공항에서 구매" },
      { chip: "먹거리", name: "이키나리당고", sub: null, mapQuery: "大福堂 上通り 熊本", desc: "고구마+팥 향토 만두. 1개 100엔", details: ["구마모토 사투리로 '간단하게'라는 뜻"], tip: "다이후쿠도(가미토리 근처)에서 현지 체험" },
      { chip: "먹거리", name: "카라시렌콘", sub: null, mapQuery: "森からし蓮根 熊本", desc: "400년 역사. 연근에 겨자 채워 튀긴 명물", details: ["선물박스 있음"], tip: "모리 카라시렌콘, 쓰루야 백화점" },
      { chip: "먹거리", name: "후가롤 (ふがロール)", sub: null, mapQuery: "Hez 本店 熊本", desc: "바삭한 과자. 유통기한 10~11개월", details: ["843엔~ / 선물용 안심"], tip: "에즈 본점, 쓰루야 백화점, 공항" },
      { chip: "먹거리", name: "구마모토 라멘 (인스턴트)", sub: null, mapQuery: "ドンキホーテ 下通り 熊本", desc: "마늘기름+돈코츠 국물 포장라멘", details: ["선물용 인기 아이템"], tip: "돈키호테, 기념품점, 공항에서 구매" },
      { chip: "굿즈", name: "쿠마몬 굿즈", sub: null, mapQuery: "くまモンビレッジ サクラマチ熊本", desc: "머그컵, 에코백, 수건, 볼펜, 스트랩 등", details: ["쿠마몬 빌리지(사쿠라마치), 쿠마몬 스퀘어(쓰루야)"], tip: "두 매장 비교 후 구매 추천" },
      { chip: "굿즈", name: "쿠마몬 스퀘어 한정", sub: null, mapQuery: "くまモンスクエア 熊本", desc: "실사 쿠마몬 상품, 시즌 한정판 (여기서만)", details: ["BAZAAR 코너 only"], tip: "스퀘어 방문 시 꼭 체크" },
      { chip: "굿즈", name: "히고코마 (肥後こま)", sub: null, mapQuery: "熊本県伝統工芸館", desc: "에도시대 전통 팽이. 12종 모양, 행운 부적", details: ["오장육부 상징 컬러"], tip: "전통공예관, 기념품점" },
      { chip: "굿즈", name: "히고 상감 (肥後象嵌)", sub: null, mapQuery: "熊本県伝統工芸館", desc: "400년 전통 금속공예. 펜던트, 넥타이핀", details: ["일본 전통공예품 지정"], tip: "쓰루야 백화점, 전통공예관" },
      { chip: "쇼핑스팟", name: "시모토리 아케이드", sub: "下通り", mapQuery: "下通りアーケード 熊本", desc: "구마모토 최대 아케이드 (510m, 폭 15m)", details: ["돈키호테 시모토리점 — 면세 가능 (여권 필수)", "드럭스토어 — 코스모스, 마츠모토키요시", "각종 잡화점, 카페, 음식점"], tip: "Day2, Day3 저녁 동선에서 자연스럽게" },
      { chip: "쇼핑스팟", name: "쓰루야 백화점", sub: "鶴屋百貨店", mapQuery: "鶴屋百貨店 熊本", desc: "구마모토현 유일 백화점. 본관/별관/윙관", details: ["쿠마몬 스퀘어 (무료, 공연+굿즈+카페)", "지하 식품관 — 과자 기념품 집중 구매", "본관 1층 — 손수건, 양말, 우산", "별관 2층 — 명품 (면세 가능)"], tip: "시모토리에서 도보 연결" },
      { chip: "쇼핑스팟", name: "사쿠라마치 쇼핑몰", sub: "SAKURA MACHI", mapQuery: "SAKURA MACHI Kumamoto", desc: "쇼핑몰 + 호텔 + 버스터미널 복합시설", details: ["쿠마몬 빌리지 (2층) — 굿즈 최다", "지브리숍, 가차숍", "5층 옥상 — 자이언트 쿠마몬 + 정원"], tip: "시모토리에서 도보 5분" },
      { chip: "쇼핑스팟", name: "JR 구마모토역", sub: "히고요카몬 시장", mapQuery: "JR熊本駅 肥後よかモン市場", desc: "역 안 기념품 구역", details: ["쿠리센리 등 대표 과자 대부분 구비", "출발/도착 시 빠르게 사기 좋음"], tip: "Day2 도착, Day4 출발 시 활용" },
    ],
  },
  {
    region: "유후인",
    color: "#6B46C1",
    chips: ["전체", "구경거리", "먹거리", "쇼핑"],
    items: [
      { chip: "구경거리", name: "유후인 플로럴 빌리지", sub: "湯布院フローラルヴィレッジ", mapQuery: "湯布院フローラルヴィレッジ", desc: "영국 코츠월드풍 동화마을", details: ["지브리 굿즈숍, 고양이카페", "알프스 소녀 하이디, 피터래빗 숍", "포토스팟 다수 — 인증샷 필수"], tip: "유후인 메인거리 초입에 위치" },
      { chip: "구경거리", name: "긴린코 호수", sub: "金鱗湖", mapQuery: "金鱗湖 由布院", desc: "유후인 상징 호수. 아침 물안개가 명물", details: ["메인거리 끝에 위치 (도보 15분)", "호수 주변 카페·갤러리 산책", "겨울 아침 물안개 포토 추천"], tip: "유후인 산책 동선의 마지막 목적지" },
      { chip: "구경거리", name: "유후다케 조망", sub: "由布岳", mapQuery: "由布院駅 展望台", desc: "유후인역 앞에서 보는 유후다케 전경", details: ["역 2층 족탕에서 산 감상 가능", "맑은 날 사진 찍기 최적"], tip: "역 도착 직후 체크" },
      { chip: "먹거리", name: "유후인 롤케이크", sub: null, mapQuery: "Bスピーク 由布院", desc: "B-speak 롤케이크. 유후인 디저트 1위", details: ["오전에 매진되는 경우 많음", "P롤(하프) / B롤(풀) 선택"], tip: "역 도착 후 바로 예약/구매 추천" },
      { chip: "먹거리", name: "크로켓 (고로케)", sub: null, mapQuery: "湯布院 金賞コロッケ", desc: "메인거리 산책하며 먹는 간식", details: ["금상 수상 고로케 등 여러 가게", "1개 200~300엔"], tip: "메인거리 걸으면서 먹기" },
      { chip: "먹거리", name: "푸린 (푸딩)", sub: null, mapQuery: "由布院 ミルヒ", desc: "유후인 우유로 만든 진한 푸딩", details: ["밀히(Milch) 등 여러 전문점", "소프트아이스크림도 인기"], tip: "플로럴빌리지 근처 디저트 타임" },
      { chip: "쇼핑", name: "유후인 메인거리", sub: "湯の坪街道", mapQuery: "湯の坪街道 由布院", desc: "역~긴린코 약 800m 메인 쇼핑거리", details: ["잡화점, 기념품점, 갤러리 밀집", "유후인 한정 상품 다수", "족탕 카페, 디저트 가게"], tip: "왕복 1~2시간 여유있게 산책" },
      { chip: "쇼핑", name: "지브리 & 캐릭터숍", sub: null, mapQuery: "どんぐりの森 湯布院", desc: "도토리의 숲(どんぐりの森) 등 캐릭터 매장", details: ["토토로, 킥키 등 지브리 굿즈", "플로럴빌리지 내 위치"], tip: "지브리 팬이라면 필수 방문" },
    ],
  },
];

function MapButton({ query }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank");
      }}
      style={{
        display: "inline-flex", alignItems: "center", gap: "4px",
        padding: "4px 10px", border: "1px solid #D4E8D0", borderRadius: "8px",
        background: "#F0F8EE", color: "#2D7A3A", fontSize: "10px", fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      📍 지도
    </button>
  );
}

function GuideCard({ item }) {
  return (
    <div style={{
      marginBottom: "10px", padding: "14px",
      background: "#FAFAF8", borderRadius: "12px",
      border: "1px solid #EEECE6",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#111" }}>{item.name}</p>
          {item.sub && <p style={{ margin: 0, fontSize: "9px", color: "#aaa", marginTop: "1px" }}>{item.sub}</p>}
        </div>
        <MapButton query={item.mapQuery} />
      </div>
      <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#666", lineHeight: 1.5 }}>{item.desc}</p>
      {item.schedule && (
        <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#C75D20", fontWeight: 600 }}>🕐 {item.schedule}</p>
      )}
      {item.details && item.details.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "8px" }}>
          {item.details.map((d, j) => (
            <div key={j} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
              <span style={{ color: "#ccc", fontSize: "8px", marginTop: "5px", flexShrink: 0 }}>●</span>
              <span style={{ fontSize: "11px", color: "#555", lineHeight: 1.5 }}>{d}</span>
            </div>
          ))}
        </div>
      )}
      {item.tip && (
        <div style={{
          padding: "6px 10px", background: "#FFF9E8", borderRadius: "8px",
          border: "1px solid #F0E8C8",
        }}>
          <span style={{ fontSize: "10px", color: "#8A7322", lineHeight: 1.5 }}>💡 {item.tip}</span>
        </div>
      )}
    </div>
  );
}

function ShoppingGuideDialog({ onClose }) {
  const [regionIdx, setRegionIdx] = useState(0);
  const [chipIdx, setChipIdx] = useState(0);
  const region = GUIDE_DATA[regionIdx];
  const filtered = chipIdx === 0 ? region.items : region.items.filter((it) => it.chip === region.chips[chipIdx]);

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
        {/* Header */}
        <div style={{
          padding: "16px 16px 0 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1a1a1a" }}>
            🗾 여행 팁 가이드
          </h3>
          <button onClick={onClose} style={{
            border: "none", background: "#F2F1ED", borderRadius: "50%",
            width: "28px", height: "28px", cursor: "pointer",
            fontSize: "14px", color: "#999", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit",
          }}>✕</button>
        </div>

        {/* Region Tabs */}
        <div style={{
          display: "flex", gap: 0, padding: "12px 20px 0",
          borderBottom: "1px solid #EEECE6",
        }}>
          {GUIDE_DATA.map((r, i) => (
            <button key={i} onClick={() => { setRegionIdx(i); setChipIdx(0); }} style={{
              flex: 1, padding: "9px 0", border: "none", background: "none",
              borderBottom: regionIdx === i ? `2.5px solid ${r.color}` : "2.5px solid transparent",
              color: regionIdx === i ? r.color : "#aaa",
              fontSize: "13px", fontWeight: regionIdx === i ? 700 : 400,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
            }}>
              {r.region}
            </button>
          ))}
        </div>

        {/* Category Chips */}
        <div style={{
          display: "flex", gap: "6px", padding: "12px 20px 0",
          overflowX: "auto", flexShrink: 0,
        }}>
          {region.chips.map((c, i) => (
            <button key={c} onClick={() => setChipIdx(i)} style={{
              flex: "none", padding: "5px 12px", borderRadius: "20px",
              border: chipIdx === i ? `1.5px solid ${region.color}` : "1.5px solid #E8E6E1",
              background: chipIdx === i ? region.color : "#fff",
              color: chipIdx === i ? "#fff" : "#777",
              fontSize: "11px", fontWeight: chipIdx === i ? 700 : 500,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}>
              {c}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px" }}>
          {filtered.map((item, i) => (
            <GuideCard key={`${regionIdx}-${chipIdx}-${i}`} item={item} />
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#bbb", fontSize: "13px" }}>
              항목이 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentDialog({ onClose }) {
  const [tab, setTab] = useState(0);
  const [viewImage, setViewImage] = useState(null);
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
            <div
              onClick={() => setViewImage(current.image)}
              style={{
                borderRadius: "12px", overflow: "hidden",
                border: "1px solid #EEECE6",
                background: "#F9F9F7",
                aspectRatio: "595 / 842",
                width: "100%",
                cursor: "zoom-in",
              }}
            >
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

      {/* Image Viewer */}
      <ImageViewer src={viewImage} alt={current.label} onClose={() => setViewImage(null)} />
    </div>
  );
}

function ImageViewer({ src, alt, onClose }) {
  if (!src) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "fadeIn 0.15s ease",
        cursor: "zoom-out",
      }}
    >
      <button onClick={onClose} style={{
        position: "absolute", top: "16px", right: "16px", zIndex: 2001,
        border: "none", background: "rgba(255,255,255,0.15)", borderRadius: "50%",
        width: "36px", height: "36px", cursor: "pointer",
        fontSize: "18px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "inherit", backdropFilter: "blur(4px)",
      }}>✕</button>
      <img
        src={src}
        alt={alt || ""}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "95vw", maxHeight: "90vh",
          objectFit: "contain", borderRadius: "4px",
          cursor: "default",
        }}
      />
    </div>
  );
}

function DetailDialog({ detail, onClose, dayColor }) {
  if (!detail) return null;
  const [viewImage, setViewImage] = useState(null);
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
        {/* Header */}
        <div style={{
          padding: "14px 16px 12px 20px", flexShrink: 0,
          borderBottom: "1px solid #EEECE6",
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <h3 style={{
              margin: 0, fontSize: "16px", fontWeight: 800,
              color: "#111", letterSpacing: "-0.3px",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {detail.name}
            </h3>
            <span style={{
              flexShrink: 0, padding: "2px 9px", borderRadius: "20px",
              fontSize: "10px", fontWeight: 700,
              background: cat.bg, color: cat.color, border: `1px solid ${cat.border}`,
              whiteSpace: "nowrap",
            }}>
              {detail.category}
            </span>
          </div>
          <button onClick={onClose} style={{
            flexShrink: 0, border: "none", background: "#F2F1ED", borderRadius: "50%",
            width: "28px", height: "28px", cursor: "pointer",
            fontSize: "14px", color: "#999", display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit",
          }}>✕</button>
        </div>

        {/* Image - top, outside scroll area for full bleed */}
        {detail.image && (
          <div
            onClick={() => setViewImage(detail.image)}
            style={{ flexShrink: 0, overflow: "hidden", cursor: "zoom-in" }}
          >
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

        {/* Image Viewer */}
        <ImageViewer src={viewImage} alt={detail.name} onClose={() => setViewImage(null)} />

        {/* Content */}
        <div style={{ overflowY: "auto", padding: "14px 20px 20px" }}>

          {/* Info rows */}
          <div style={{
            display: "flex", flexDirection: "column", gap: "8px",
            padding: "14px", background: "#FAFAF8", borderRadius: "12px",
            border: "1px solid #EEECE6", marginBottom: "14px",
          }}>
            {detail.address && (
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "13px", flexShrink: 0, marginTop: "1px" }}>📍</span>
                <span style={{ flex: 1, fontSize: "12px", color: "#555", lineHeight: 1.5 }}>{detail.address}</span>
                <MapButton query={detail.address} />
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

      </div>
    </div>
  );
}

export default function TravelPlanner() {
  const [selectedDay, setSelectedDay] = useState(0);
  const [activeDetail, setActiveDetail] = useState(null);
  const [showDocs, setShowDocs] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [dayInfoTab, setDayInfoTab] = useState(null);
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
          onClick={() => setShowGuide(true)}
          style={{
            width: "36px", height: "36px", borderRadius: "10px",
            border: "1px solid #E8E6E1", background: "#FAFAF8",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: "16px", flexShrink: 0,
            transition: "background 0.15s",
          }}
          title="쇼핑 가이드"
        >
          🐻
        </button>
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
          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
            <button onClick={() => setDayInfoTab("meals")} style={{
              padding: "6px 10px", borderRadius: "10px",
              border: "1px solid #FDDCC8", background: "#FFF3EC",
              fontSize: "12px", cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: "3px",
            }}>
              🍽<span style={{ fontSize: "10px", fontWeight: 600, color: "#C75D20" }}>식사</span>
            </button>
            <button onClick={() => setDayInfoTab("stay")} style={{
              padding: "6px 10px", borderRadius: "10px",
              border: "1px solid #C6F0D5", background: "#F0FAF4",
              fontSize: "12px", cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: "3px",
            }}>
              🏨<span style={{ fontSize: "10px", fontWeight: 600, color: "#2A7D4F" }}>숙소</span>
            </button>
          </div>
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
                    {item.detail && item.detail.address && (
                      <div style={{ flexShrink: 0, alignSelf: "center" }}>
                        <MapButton query={item.detail.address} />
                      </div>
                    )}
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

      {/* Shopping Guide Dialog */}
      {showGuide && <ShoppingGuideDialog onClose={() => setShowGuide(false)} />}

      {/* Day Info Dialog (식사/숙소) */}
      {dayInfoTab && <DayInfoDialog dayNum={current.day} tab={dayInfoTab} onClose={() => setDayInfoTab(null)} color={current.color} />}
    </div>
  );
}
