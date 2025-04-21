import DaumPostcode from "react-daum-postcode";

interface DaumPostcodeData {
  address: string; // 전체 주소 (사용자 선택 기준)
  addressType: string; // "R" (도로명) 또는 "J" (지번)
  apartment: string;
  autoJibunAddress: string;
  autoRoadAddress: string;
  bcode: string;
  buildingCode: string;
  buildingName: string;
  zonecode: string; // 우편번호
  jibunAddress: string; // 지번 주소
  roadAddress: string; // 도로명 주소
  userSelectedType: "J" | "R"; // 사용자가 선택한 주소 타입
}

const AddressInput: React.FC<{
  setAddress: React.Dispatch<React.SetStateAction<string>>;
}> = ({ setAddress }) => {
  const completeHandler = (data: DaumPostcodeData) => {
    setAddress(data.address);
  };
  return (
    <div>
      <DaumPostcode onComplete={completeHandler} />
    </div>
  );
};

export default AddressInput;
