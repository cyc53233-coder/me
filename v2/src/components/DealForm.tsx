"use client";

import { useActionState } from "react";
import { addDeal, type FormState } from "@/app/admin/actions";
import { MALLS } from "@/lib/site";

const EMPTY: FormState = {};

export function DealForm() {
  const [state, formAction, pending] = useActionState(addDeal, EMPTY);

  return (
    <form className="form" action={formAction}>
      {state.error && <p className="error">{state.error}</p>}
      {state.ok && <p className="disclosure">✅ {state.ok}</p>}

      <div className="field">
        <label htmlFor="title">상품명</label>
        <input id="title" name="title" required placeholder="하림펫푸드 밥이보약 DOG 3.4kg" />
      </div>

      <div className="field">
        <label htmlFor="url">내 쉐어링크 / 파트너스 링크</label>
        <input id="url" name="url" type="url" required placeholder="https://..." />
        <small>이 주소로 바로 보내지 않고 /go/&lt;id&gt; 를 거칩니다. 클릭 수를 세기 위해서입니다.</small>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="price">지금 가격</label>
          <input id="price" name="price" inputMode="numeric" required placeholder="19900" />
        </div>
        <div className="field">
          <label htmlFor="list_price">평소 가격</label>
          <input id="list_price" name="list_price" inputMode="numeric" placeholder="34000" />
          <small>넣으면 할인율이 자동 계산됩니다</small>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="mall">쇼핑몰</label>
          <select id="mall" name="mall" defaultValue="toss">
            {Object.entries(MALLS).map(([key, m]) => (
              <option key={key} value={key}>
                {m.emoji} {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="category">카테고리</label>
          <input id="category" name="category" placeholder="식품 / 생활 / 가전 …" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="image">상품 이미지 주소</label>
        <input id="image" name="image" type="url" placeholder="비워 두면 쇼핑몰 아이콘이 들어갑니다" />
      </div>

      <div className="field">
        <label htmlFor="note">한 줄 메모</label>
        <input id="note" name="note" placeholder="평소가 3.4만대" />
      </div>

      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" name="hot" style={{ width: "auto" }} />
          🔥 대박 표시 달기
        </label>
      </div>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? "올리는 중…" : "딜 올리기"}
      </button>
    </form>
  );
}
