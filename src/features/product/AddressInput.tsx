import DaumPostcode from "react-daum-postcode";

interface DaumPostcodeData {
  address: string;
  addressType: string;
  apartment: string;
  autoJibunAddress: string;
  autoRoadAddress: string;
  bcode: string;
  buildingCode: string;
  buildingName: string;
  zonecode: string;
  jibunAddress: string;
  roadAddress: string;
  userSelectedType: "J" | "R";
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
