package com.globits.richy.dto;

import com.globits.richy.domain.*;

public final class FairDto {
    private FairDto() {}
    public static class Balance {
        public Long eventId;
        public String cardCode, displayName;
        public boolean guest;
        public int balance;
        public Balance(FairWallet wallet) {
            eventId = wallet.eventId; cardCode = wallet.cardCode; displayName = wallet.displayName;
            guest = wallet.guestNumber != null; balance = wallet.balance;
        }
    }
    public static class EventRequest { public String name; public Boolean active; public Integer easyAmount, mediumAmount, hardAmount; }
    public static class GuestRequest { public Integer count; }
    public static class StationRequest { public String operatorName, name, operation, tier; }
    public static class TransactionRequest { public String cardCode, operation, requestKey, tier; public Integer amount; }
    public static class CorrectionRequest { public String requestKey, reason; public Integer amount; }
    public static class UndoRequest { public String requestKey; }
    public static class Operator {
        public String username;
        public boolean admin, canPlay, canGift;
        public FairStation station;
    }
    public static class Receipt {
        public Balance participant;
        public FairTransaction transaction;
        public boolean replayed;
        public Receipt(FairWallet wallet, FairTransaction transaction, boolean replayed) {
            participant = new Balance(wallet); this.transaction = transaction; this.replayed = replayed;
        }
    }
}
