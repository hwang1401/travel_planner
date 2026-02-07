export const BASE_DAYS = [
  {
    day: 1, date: "2/19 (목)", label: "인천 → 하카타",
    color: "#D94F3B", icon: "navigation", stay: "하카타 1박", booked: true,
    sections: [
      {
        title: "오후",
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
          { time: "17:10", desc: "후쿠오카공항 도착", type: "move",
            detail: {
              name: "후쿠오카공항 국제선 터미널",
              category: "교통",
              tip: "입국심사 + 수하물 수령까지 약 25~30분 소요",
              highlights: ["입국카드 기내에서 미리 작성", "세관 신고서 필요 (면세품 있을 경우)"],
            }
          },
          { time: "17:35", desc: "입국심사 + 수하물 수령", type: "info" },
          { time: "17:40", desc: "공항 직행버스 탑승 → 하카타역", type: "move", sub: "약 20분 · 310엔",
            detail: {
              name: "공항 → 하카타역 (직행버스)",
              category: "교통",
              tip: "국제선 터미널 1번 승차장에서 탑승",
              timetable: {
                _routeId: "fukuoka_airport_bus",
                station: "후쿠오카공항 국제선 터미널",
                direction: "하카타역 방면",
                trains: [
                  { time: "매 15~20분", name: "직행버스 (니시테츠)", dest: "하카타역 치쿠시구치", note: "약 20분 · 310엔", picked: true },
                  { time: "매 5~8분", name: "셔틀+지하철", dest: "국내선 환승 → 하카타역", note: "약 25~35분 · 260엔", picked: false },
                ],
              },
              highlights: [
                "직행버스: 국제선→하카타역 치쿠시구치 (환승 불필요)",
                "지하철: 무료셔틀로 국내선 이동 → 공항선 2정거장 (5분)",
                "짐 많으면 직행버스 추천 / 시간 정확성은 지하철 우세",
              ],
            }
          },
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
    color: "#D97B2B", icon: "car", stay: "구마모토 1박", booked: false,
    sections: [
      {
        title: "오전",
        items: [
          { time: "10:00", desc: "스미요시 숙소 체크아웃", type: "stay" },
          { time: "10:15", desc: "하카타역으로 이동", type: "move", sub: "도보 15분" },
          { time: "10:30", desc: "JR 북큐슈 5일권 수령 & 개시", type: "info",
            detail: {
              name: "JR 북큐슈 5일권",
              category: "교통",
              image: "/images/jrpass_voucher.jpg",
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
              image: "/images/sakura547.jpg",
              tip: "JR 북큐슈 5일권으로 자유석 탑승 가능 · 지정석도 6회까지 OK",
              timetable: {
                _routeId: "hakata_kumamoto",
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
                "[참고] みずほ는 지정석만 가능 (자유석 없음, 지정석 횟수 차감)",
              ],
            }
          },
          { time: "11:33", desc: "구마모토역 도착", type: "move",
            detail: {
              name: "구마모토역 도착",
              category: "교통",
              tip: "신칸센 출구 → 재래선·노면전차 안내판 따라 이동",
              highlights: ["코인로커: 역내 2층 (400~700엔)", "노면전차: 역 정면 광장에서 탑승"],
            }
          },
          { time: "11:40", desc: "역 코인로커에 짐 보관", type: "info", sub: "400~700엔" },
          { time: "11:50", desc: "노면전차 → 시모토리 방면", type: "move", sub: "15분 · 170엔",
            detail: {
              name: "노면전차 (구마모토역→시모토리)",
              category: "교통",
              tip: "구마모토역 전정에서 A계통 탑승 · 시모토리 하차",
              timetable: {
                _routeId: "kumamoto_tram",
                station: "구마모토역 전정",
                direction: "시모토리·스이젠지 방면",
                trains: [
                  { time: "매 6~8분", name: "A계통", dest: "다시마에도리 → 건군신사", note: "170엔 균일요금", picked: true },
                  { time: "매 6~8분", name: "B계통", dest: "가미구마모토 → 스이젠지", note: "170엔 균일요금", picked: false },
                ],
              },
              highlights: [
                "A계통 탑승 → '시모토리(辛島町)' 하차 (약 15분)",
                "배차 6~8분 간격이라 대기 시간 짧음",
                "1일권 500엔 (3회 이상 타면 이득)",
                "[팁] 하나바타초역 = 구마모토성 최근접",
              ],
            }
          },
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
              highlights: ["일본 3대 명성", "천수각 6층 360도 파노라마 전망", "2016 지진 후 복원 — 돌담 복구 과정 볼 수 있음", "[팁] 하나바타초역에서 내리면 더 가까움"],
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
          { time: "15:00", desc: "노면전차 → 스이젠지", type: "move", sub: "20분 · 170엔",
            detail: {
              name: "노면전차 (시모토리→스이젠지)",
              category: "교통",
              tip: "B계통 탑승 · 스이젠지코엔마에(水前寺公園) 하차",
              timetable: {
                _routeId: "kumamoto_tram",
                station: "시모토리(辛島町)",
                direction: "스이젠지 방면",
                trains: [
                  { time: "매 6~8분", name: "B계통", dest: "스이젠지 공원", note: "170엔 균일요금 · 약 20분", picked: true },
                ],
              },
              highlights: [
                "B계통 탑승 → '스이젠지코엔마에' 하차",
                "배차 6~8분 간격",
                "하차 후 도보 3분 → 스이젠지 조주엔 입구",
              ],
            }
          },
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
          { time: "16:05", desc: "노면전차 → 구마모토역 복귀", type: "move", sub: "20분 · 170엔",
            detail: {
              name: "노면전차 (스이젠지→구마모토역)",
              category: "교통",
              tip: "B계통 역방향 탑승 → 구마모토역 전정 하차",
              timetable: {
                _routeId: "kumamoto_tram",
                station: "스이젠지코엔마에",
                direction: "구마모토역 방면",
                trains: [
                  { time: "매 6~8분", name: "B계통 (역방향)", dest: "구마모토역 전정", note: "170엔 균일요금 · 약 20분", picked: true },
                ],
              },
              highlights: [
                "스이젠지코엔마에 → 구마모토역 전정",
                "배차 6~8분 간격",
                "역 도착 후 코인로커 짐 회수",
              ],
            }
          },
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
              image: "/images/suginoya.jpg",
              address: "熊本市中央区下通1-9-1 ダイワロイネットホテル 2F",
              hours: "11:30~14:00 / 17:00~20:30",
              price: "코스 5,000~8,000엔",
              tip: "구마모토 바사시의 대명사! 자사 목장 직송 말고기",
              highlights: ["코스: 바사시 모둠 → 구이 → 말고기 초밥 → 디저트", "희소 부위도 맛볼 수 있음", "[참고] 코스는 전일 예약 필수!", "온라인 예약 가능 (핫페퍼/구루나비)"],
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
    color: "#B8912A", icon: "flag", stay: "구마모토 1박", booked: false,
    sections: [
      {
        title: "오전",
        items: [
          { time: "10:30", desc: "구마모토역 출발 (JR 호히본선)", type: "move", sub: "JR패스 이용 · 약 1시간 15분",
            detail: {
              name: "구마모토 → 아소 (JR 호히본선)",
              category: "교통",
              image: "/images/asoboi.jpeg",
              tip: "JR 북큐슈 5일권 커버 · 특급 이용 시 지정석 횟수 차감",
              timetable: {
                _routeId: "kumamoto_aso",
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
                "[참고] 열차 편수가 적으니 시간 반드시 확인!",
              ],
            }
          },
          { time: "11:45", desc: "아소역 도착", type: "move",
            detail: {
              name: "아소역 도착",
              category: "교통",
              tip: "아소역 앞 버스 정류장에서 아소산행 버스 탑승",
              highlights: ["역 앞 관광안내소에서 지도·정보 수집 가능", "코인로커 있음 (400엔~)"],
            }
          },
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
        title: "오후",
        items: [
          { time: "13:00", desc: "아소역 앞 버스 탑승 → 아소산", type: "move", sub: "약 26분 · ~600엔",
            detail: {
              name: "아소역 → 쿠사센리 (산교버스)",
              category: "교통",
              tip: "아소역앞 버스 정류장에서 아소 등산선 탑승",
              timetable: {
                _routeId: "aso_bus_up",
                station: "아소역앞",
                direction: "쿠사센리·아소산상 터미널 방면",
                trains: [
                  { time: "09:40", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔", picked: false },
                  { time: "10:25", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔", picked: false },
                  { time: "11:50", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔", picked: false },
                  { time: "12:50", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔", picked: true },
                  { time: "13:30", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔", picked: false },
                  { time: "14:10", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔", picked: false },
                  { time: "14:35", name: "아소 등산선", dest: "쿠사센리·아소산상", note: "약 26분 · ~600엔", picked: false },
                ],
              },
              highlights: [
                "산교(産交)버스 운행 — JR패스 미적용",
                "[참고] 편수 적음 — 반드시 시간 확인",
                "[참고] 혼잡 시 탑승 불가 가능 — 여유있게",
                "동절기(2월) 시간표 변동 가능 — 현지 확인 필수",
              ],
            }
          },
          { time: "13:30", desc: "쿠사센리 초원 + 나카다케 화구 전망", type: "spot", sub: "약 1시간",
            detail: {
              name: "쿠사센리 · 나카다케 화구",
              category: "관광",
              address: "아소산 정상부",
              tip: "화산활동에 따라 화구 접근 제한 가능 — 당일 확인 필수",
              highlights: ["쿠사센리 초원 산책 + 나카다케 활화산 전망", "[참고] 화구 제한 시 Plan B: 승마체험 + 아소 화산박물관", "[참고] 2월 아소산은 0~5°C → 방한 준비 필수!", "화구 상황 확인: aso.ne.jp/~volcano/"],
            }
          },
          { time: "14:30", desc: "버스로 하산 → 아소역", type: "move", sub: "약 26분 · ~600엔",
            detail: {
              name: "쿠사센리 → 아소역 (산교버스)",
              category: "교통",
              tip: "쿠사센리 버스 정류장에서 하행 버스 탑승",
              timetable: {
                _routeId: "aso_bus_down",
                station: "쿠사센리·아소산상 터미널",
                direction: "아소역앞 방면",
                trains: [
                  { time: "10:15", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔", picked: false },
                  { time: "11:00", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔", picked: false },
                  { time: "12:20", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔", picked: false },
                  { time: "13:20", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔", picked: false },
                  { time: "14:00", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔", picked: true },
                  { time: "14:40", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔", picked: false },
                  { time: "15:05", name: "아소 등산선", dest: "아소역앞", note: "약 26분 · ~600엔", picked: false },
                ],
              },
              highlights: [
                "산교(産交)버스 운행 — JR패스 미적용",
                "[참고] 마지막 버스 놓치지 않도록 시간 체크!",
                "하산 후 아소 신사 방면으로 이동",
              ],
            }
          },
        ],
      },
      {
        title: "늦은 오후",
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
              image: "/images/asoboi.jpeg",
              tip: "JR 북큐슈 5일권 커버 · 놓치면 다음 열차까지 대기 길어짐",
              timetable: {
                _routeId: "aso_kumamoto",
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
                "[참고] 열차 편수 적음 — 아소 신사에서 시간 조절 필요!",
              ],
            }
          },
        ],
      },
      {
        title: "저녁",
        items: [
          { time: "17:15", desc: "구마모토역 도착 → 숙소 휴식", type: "stay" },
          { time: "18:30", desc: "시모토리로 출발 (노면전차)", type: "move", sub: "15분 · 170엔",
            detail: {
              name: "노면전차 (구마모토역→시모토리)",
              category: "교통",
              tip: "구마모토역 전정에서 A계통 탑승",
              timetable: {
                _routeId: "kumamoto_tram",
                station: "구마모토역 전정",
                direction: "시모토리 방면",
                trains: [
                  { time: "매 6~8분", name: "A계통", dest: "시모토리", note: "170엔 · 약 15분", picked: true },
                ],
              },
              highlights: [
                "A계통 → 시모토리 하차",
                "배차 6~8분 간격",
              ],
            }
          },
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
    color: "#3E8E5B", icon: "compass", stay: "유후인 1박", booked: false,
    sections: [
      {
        title: "오전",
        items: [
          { time: "09:00", desc: "구마모토 호텔 체크아웃", type: "stay" },
          { time: "09:42", desc: "신칸센 탑승 (구마모토→쿠루메)", type: "move", sub: "약 20분 · JR패스",
            detail: {
              name: "구마모토 → 쿠루메 (신칸센)",
              category: "교통",
              tip: "JR 북큐슈 5일권 자유석 탑승 · 쿠루메역에서 큐다이본선 환승",
              timetable: {
                _routeId: "kumamoto_kurume",
                station: "구마모토역",
                direction: "쿠루메(하카타) 방면",
                trains: [
                  { time: "08:00", name: "さくら540", dest: "博多", note: "쿠루메 20분 · 하카타 33분", picked: false },
                  { time: "08:42", name: "つばめ310", dest: "博多", note: "쿠루메 약 30분", picked: false },
                  { time: "09:42", name: "さくら542", dest: "博多", note: "쿠루메 20분", picked: true },
                  { time: "10:42", name: "さくら544", dest: "博多", note: "쿠루메 20분", picked: false },
                  { time: "11:42", name: "さくら546", dest: "博多", note: "쿠루메 20분", picked: false },
                ],
              },
              highlights: [
                "JR 북큐슈 5일권 자유석 탑승 가능",
                "쿠루메역에서 JR큐다이본선 환승 → 유후인",
                "さくら가 빠름 (쿠루메까지 약 20분)",
              ],
            }
          },
          { time: "10:02", desc: "쿠루메역 도착 → 큐다이본선 환승", type: "move" },
          { time: "10:45", desc: "특급 유후인노모리 탑승", type: "move", sub: "약 1시간 40분 · JR패스(지정석)",
            detail: {
              name: "쿠루메 → 유후인 (JR 큐다이본선)",
              category: "교통",
              tip: "JR 북큐슈 5일권 커버 · 유후인노모리는 전석 지정석 (지정석 횟수 차감)",
              timetable: {
                _routeId: "kurume_yufuin",
                station: "쿠루메역",
                direction: "유후인·오이타 방면",
                trains: [
                  { time: "08:45", name: "특급 ゆふいんの森1호", dest: "유후인·별부", note: "약 1시간 40분 · 전석지정석", picked: false },
                  { time: "10:45", name: "특급 ゆふいんの森3호", dest: "유후인·별부", note: "약 1시간 40분 · 전석지정석", picked: true },
                  { time: "11:45", name: "특급 ゆふ3호", dest: "유후인·별부", note: "약 1시간 45분 · 자유석 있음", picked: false },
                  { time: "13:45", name: "특급 ゆふいんの森5호", dest: "유후인·별부", note: "약 1시간 40분 · 전석지정석", picked: false },
                  { time: "16:45", name: "특급 ゆふ5호", dest: "유후인·별부", note: "약 1시간 45분 · 자유석 있음", picked: false },
                ],
              },
              highlights: [
                "ゆふいんの森: 전석 지정석 관광열차 (지정석 횟수 차감)",
                "ゆふ: 자유석 있음 (JR 북큐슈 5일권 자유석 탑승 가능)",
                "[참고] ゆふいんの森는 인기 많아 미리 예약 추천!",
                "차창 밖 큐슈 산간 풍경이 절경",
              ],
            }
          },
          { time: "12:25", desc: "유후인역 도착", type: "move",
            detail: {
              name: "유후인역",
              category: "교통",
              tip: "역 2층에 족탕 있음 (무료) · 유후다케 조망 포인트",
              highlights: ["역 앞에서 유후다케 전경 사진 촬영", "관광안내소에서 지도 수령", "메인거리(유노쓰보가도)까지 도보 5분"],
            }
          },
        ],
      },
      {
        title: "오후 · 저녁",
        items: [
          { time: "12:30", desc: "유후인 료칸 체크인 & 짐 맡기기", type: "stay" },
          { time: "13:00", desc: "유후인 유노쓰보 거리 산책", type: "shop",
            detail: {
              name: "유노쓰보가도 (湯の坪街道)",
              category: "쇼핑",
              address: "유후인역 → 긴린코 방면 메인거리",
              tip: "역에서 긴린코까지 약 800m, 왕복 1~2시간 여유있게",
              highlights: ["B-speak 롤케이크 (오전 매진 주의)", "금상 고로케 먹어보기", "플로럴 빌리지 (동화마을)", "밀히(Milch) 푸딩"],
            }
          },
          { time: "15:00", desc: "긴린코 호수 산책", type: "spot",
            detail: {
              name: "긴린코 (金鱗湖)",
              category: "관광",
              address: "유후인 메인거리 끝",
              tip: "겨울 아침에 물안개 피어오르는 포토스팟",
              highlights: ["메인거리 끝에 위치 (도보 15분)", "호수 주변 카페·갤러리 산책", "겨울 아침 물안개 포토 추천"],
            }
          },
          { time: "16:00", desc: "료칸 복귀 & 온천", type: "stay" },
          { time: "저녁", desc: "료칸 카이세키 요리", type: "food" },
        ],
      },
    ],
    notes: "구마모토→쿠루메(신칸센 20분)→유후인(특급 1시간 40분) / JR 5일권 커버 / 료칸 후보: 센도·바이엔·겟토안",
  },
  {
    day: 5, date: "2/23 (월)", label: "유후인 → 하카타",
    color: "#3A7DB5", icon: "shopping", stay: "하카타 1박", booked: false,
    sections: [
      {
        title: "오전",
        items: [
          { time: "09:00", desc: "킨린코 호수 아침 산책", type: "spot",
            detail: {
              name: "긴린코 아침 산책",
              category: "관광",
              address: "유후인 메인거리 끝",
              tip: "겨울 아침 물안개가 피어오르는 환상적인 풍경",
              highlights: ["아침 일찍 가면 물안개 볼 확률 높음", "료칸 조식 후 산책 추천"],
            }
          },
          { time: "10:00", desc: "료칸 체크아웃 & 유후인역 이동", type: "stay" },
        ],
      },
      {
        title: "낮",
        items: [
          { time: "11:18", desc: "특급 유후인노모리 탑승 → 하카타", type: "move", sub: "약 2시간 15분 · JR패스(지정석)",
            detail: {
              name: "유후인 → 하카타 (JR 특급)",
              category: "교통",
              tip: "JR 북큐슈 5일권 커버 · 유후인노모리는 전석 지정석",
              timetable: {
                _routeId: "yufuin_hakata",
                station: "유후인역",
                direction: "하카타 방면",
                trains: [
                  { time: "11:18", name: "특급 ゆふいんの森2호", dest: "博多", note: "약 2시간 15분", picked: true },
                  { time: "13:55", name: "특급 ゆふ4호", dest: "博多", note: "약 2시간 20분", picked: false },
                  { time: "15:38", name: "특급 ゆふいんの森4호", dest: "博多", note: "약 2시간 15분", picked: false },
                  { time: "16:45", name: "특급 ゆふいんの森6호", dest: "博多", note: "약 2시간 15분", picked: false },
                  { time: "17:06", name: "특급 ゆふ6호", dest: "博多", note: "약 2시간 20분", picked: false },
                ],
              },
              highlights: [
                "ゆふいんの森: 전석 지정석 관광열차",
                "ゆふ: 자유석 있음 (JR 북큐슈 5일권)",
                "[참고] ゆふいんの森는 인기 많아 미리 예약!",
                "차창 밖 큐슈 산간 풍경 감상",
              ],
            }
          },
          { time: "13:33", desc: "하카타역 도착", type: "move",
            detail: {
              name: "하카타역 도착",
              category: "교통",
              tip: "하카타역에서 숙소 체크인 후 쇼핑 시작",
              highlights: ["캐널시티까지 도보 10분", "텐진까지 지하철 5분"],
            }
          },
        ],
      },
      {
        title: "오후 · 저녁",
        items: [
          { time: "14:00", desc: "숙소 체크인 & 짐 맡기기", type: "stay" },
          { time: "14:30", desc: "캐널시티 / 텐진 쇼핑", type: "shop",
            detail: {
              name: "텐진·캐널시티 쇼핑",
              category: "쇼핑",
              tip: "텐진 지하상가 + 캐널시티 + 하카타역 주변",
              highlights: ["텐진 지하상가: 150개+ 매장, 비올 때 최적", "캐널시티: 분수 쇼 + 쇼핑", "면세 쇼핑은 여권 지참 필수"],
            }
          },
          { time: "19:00", desc: "나카스 포장마차 야타이 체험", type: "food",
            detail: {
              name: "나카스 야타이 (포장마차)",
              category: "식사",
              address: "福岡市博多区中洲 나카가와 강변",
              hours: "저녁 6시경~",
              price: "1인 2,000~3,000엔",
              tip: "강변 포장마차 줄에서 분위기 좋은 곳 골라 앉기",
              highlights: ["라멘, 교자, 오뎅, 야키토리 등 다양", "한 곳당 8~10석 소규모", "후쿠오카 여행의 하이라이트!"],
            }
          },
          { time: "21:00", desc: "숙소 복귀", type: "stay" },
        ],
      },
    ],
    notes: "유후인→하카타 JR 특급 약 2시간 15분 (5일권 커버) / 오후: 텐진·캐널시티 쇼핑",
  },
  {
    day: 6, date: "2/24 (화)", label: "하카타 → 인천",
    color: "#7161A5", icon: "navigation", stay: "귀국", booked: true,
    sections: [
      {
        title: "오전",
        items: [
          { time: "07:30", desc: "숙소 체크아웃", type: "stay" },
          { time: "08:00", desc: "하카타역 → 후쿠오카공항", type: "move", sub: "직행버스 20분 · 310엔",
            detail: {
              name: "하카타역 → 후쿠오카공항 국제선",
              category: "교통",
              tip: "출국 2시간 전 공항 도착 권장 — 8시 출발이면 여유",
              timetable: {
                _routeId: "hakata_fukuoka_airport",
                station: "하카타역",
                direction: "후쿠오카공항 국제선 방면",
                trains: [
                  { time: "매 15~20분", name: "직행버스 (니시테츠)", dest: "공항 국제선 터미널", note: "약 20분 · 310엔", picked: true },
                  { time: "매 5~8분", name: "지하철+셔틀", dest: "공항역 → 국제선 환승", note: "약 25~35분 · 260엔", picked: false },
                ],
              },
              highlights: [
                "직행버스: 하카타역 치쿠시구치 → 국제선 직행",
                "지하철: 하카타역 → 공항역(5분) → 무료셔틀로 국제선(10분)",
                "[참고] 국제선은 국내선과 별도 터미널!",
                "출국 2시간 전 공항 도착 권장",
              ],
            }
          },
          { time: "08:30", desc: "후쿠오카공항 도착 → 면세 쇼핑", type: "shop",
            detail: {
              name: "후쿠오카공항 면세 쇼핑",
              category: "쇼핑",
              tip: "출국 수속 후 면세 구역에서 쇼핑",
              highlights: ["면세점에서 위스키·화장품·과자류 구매", "못 산 기념품 마지막 찬스"],
            }
          },
          { time: "10:30", desc: "후쿠오카공항 출발 (KE788)", type: "move",
            detail: {
              name: "후쿠오카 → 인천 (KE788)",
              category: "교통",
              tip: "대한항공 KE788 · 후쿠오카 10:30 → 인천 12:00",
              highlights: ["대한항공 KE788", "비행시간 약 1시간 30분", "수하물 1pc (23kg)"],
            }
          },
          { time: "12:00", desc: "인천공항 도착", type: "move",
            detail: {
              name: "인천공항 도착",
              category: "교통",
              tip: "입국심사 + 수하물 수령 후 귀가",
              highlights: ["수하물 수령 → 세관 → 출구"],
            }
          },
        ],
      },
    ],
    notes: "대한항공 KE788 · 수하물 1pc · 출국 2시간 전 공항 도착 권장",
  },
];

export const DAY_INFO = {
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
        { name: "스가노야 긴자도리점", time: "18:00", price: "코스 5,000~8,000엔", mapQuery: "菅乃屋 銀座通り店 熊本", note: "바사시(말고기) 코스 · [참고] 전일 예약 필수!" },
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

export const DAY_COLORS = ["#D94F3B", "#D97B2B", "#B8912A", "#3E8E5B", "#3A7DB5", "#7161A5", "#C75D78", "#5B8C6E", "#8B6E4F", "#4A6FA5"];
