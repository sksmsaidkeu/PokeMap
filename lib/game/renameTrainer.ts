import { callEdgeFunction, type EdgeFunctionError, type EdgeFunctionResult } from './callEdgeFunction'

// profiles는 no_direct_write RLS로 클라이언트 직접 쓰기가 전면 차단되어 있어(DB.md §8,
// migration 20260716200000) rename-trainer Edge Function(service_role)을 거쳐야 한다.
// 길이 규칙(2~20자)은 bootstrap-location EF와 동일 — 서버에 별도 금칙어 필터가 없어 그대로 따른다.
export type RenameTrainerSuccess = { nickname: string }

export type RenameTrainerErrorCode = 'INVALID_NICKNAME' | 'NICKNAME_TAKEN'

export type RenameTrainerResult = EdgeFunctionResult<RenameTrainerSuccess, RenameTrainerErrorCode>
export type RenameTrainerError = EdgeFunctionError<RenameTrainerErrorCode>

export async function renameTrainer(nickname: string): Promise<RenameTrainerResult> {
  const trimmed = nickname.trim()
  if (trimmed.length < 2 || trimmed.length > 20) {
    return {
      data: null,
      error: { code: 'INVALID_NICKNAME', message: '트레이너 이름은 2~20자로 입력해 주세요' },
    }
  }

  return callEdgeFunction('rename-trainer', { nickname: trimmed }, '이름 변경 실패')
}
